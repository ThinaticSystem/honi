import autobind from 'autobind-decorator';
import * as loki from 'lokijs';
import Module from '@/module';
import Message from '@/message';
import serifs, { getSerif } from '@/serifs';
import { acct } from '@/utils/acct';
import config from '@/config';
import * as T from 'terrario';

const NOTIFY_INTERVAL = 1000 * 60 * 60 * 12;

interface Remind {
		userId: string;
		id: string;
		thing: string | null;
		quoteId: string | null;
		times: number; // 催促した回数(使うのか？)
		createdAt: number;
}

export default class extends Module {
	public readonly name = 'reminder';

	private reminds: loki.Collection<Remind>;

	@autobind
	public install() {
		this.reminds = this.ai.getCollection('reminds', {
			indices: ['userId', 'id']
		});

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		let text = msg.extractedText.toLowerCase();

		const spaceParser = T.str(/[\s　]+/).option();
		const idParser = T.str(/\w/).many(10).map(chars => chars.join(''));
		const yappayameParser = T.alt([
			T.str('やめ'),
			T.str('消し'),
			T.str('けし'),
			T.str('忘れ'),
			T.str('わすれ'),
		]);
		const removeSpecificReminderParser = T.alt([
			T.seq([
				yappayameParser,
				spaceParser.option(),
				idParser,
			], 2),

			T.seq([
				idParser,
				spaceParser.option(),
				yappayameParser,
			], 0),
		]);
		const removeSpecificReminderParseResult = removeSpecificReminderParser.parse(text);
		if (removeSpecificReminderParseResult.success) {
			const removeResult = this.removeSpecificReminder(removeSpecificReminderParseResult.value);
			if (removeResult) {
				msg.reply(`吹き飛ばしといたよ\nリマインド: ${removeResult.thing}`);
			}
			return {
				reaction: '🗑',
				immediate: true,
			};
		}

		if (!text.startsWith('remind') && !text.startsWith('todo') && !text.startsWith('リマインド')) return false;

		if (text.startsWith('reminds') || text.startsWith('todos') || text.startsWith('やること')) {
			const reminds = this.reminds.find({
				userId: msg.userId,
			});

			const getQuoteLink = id => `[${id}](${config.host}/notes/${id})`;

			msg.reply(serifs.reminder.reminds + '\n' + reminds.map(remind => `・${remind.id}: ${remind.thing ? remind.thing : getQuoteLink(remind.quoteId)}`).join('\n'));
			return true;
		}

		if (text.match(/^(.+?)\s(.+)/)) {
			text = text.replace(/^(.+?)\s/, '');
		} else {
			text = '';
		}

		const separatorIndex = text.indexOf(' ') > -1 ? text.indexOf(' ') : text.indexOf('\n');
		const thing = text.substr(separatorIndex + 1).trim();

		if (thing === '' && msg.quoteId == null || msg.visibility === 'followers') {
			msg.reply(serifs.reminder.invalid);
			return {
				reaction: '🆖',
				immediate: true,
			};
		}

		const remind = this.reminds.insertOne({
			id: msg.id,
			userId: msg.userId,
			thing: thing === '' ? null : thing,
			quoteId: msg.quoteId,
			times: 0,
			createdAt: Date.now(),
		});

		// メンションをsubscribe
		this.subscribeReply(remind!.id, msg.id, {
			id: remind!.id
		});

		if (msg.quoteId) {
			// 引用元をsubscribe
			this.subscribeReply(remind!.id, msg.quoteId, {
				id: remind!.id
			});
		}

		// タイマーセット
		this.setTimeoutWithPersistence(NOTIFY_INTERVAL, {
			id: remind!.id,
		});

		return {
			reaction: '🆗',
			immediate: true,
		};
	}

	/**
	 * 指定されたIDのリマインドを消す
	 * @param id remindのid!
	 * @returns 成功: 消したやつ | 失敗: false
	 */
	private removeSpecificReminder(id: string): Remind | false {
		const remind = this.reminds.findOne({
			id: id,
		});
		if (remind == null) return false;

		this.unsubscribeReply(remind.thing == null && remind.quoteId ? remind.quoteId : remind.id);
		this.reminds.remove(remind);
		return remind;
	};

	@autobind
	private async contextHook(key: any, msg: Message, data: any) {
		if (msg.text == null) return;

		const remind = this.reminds.findOne({
			id: data.id,
		});

		if (remind == null) {
			this.unsubscribeReply(key);
			return;
		}

		const done = msg.includes(['done', 'やった', 'やりました', 'はい']);
		const cancel = msg.includes(['やめ', 'キャンセル']);
		const isOneself = msg.userId === remind.userId;

		if ((done || cancel) && isOneself) {
			this.unsubscribeReply(key);
			this.reminds.remove(remind);
			msg.reply(done ? getSerif(serifs.reminder.done(msg.friend.name)) : serifs.reminder.cancel);
			return;
		} else if (isOneself === false) {
			msg.reply(serifs.reminder.doneFromInvalidUser);
			return;
		} else {
			return false;
		}
	}

	@autobind
	private async timeoutCallback(data) {
		const remind = this.reminds.findOne({
			id: data.id
		});
		if (remind == null) return;

		remind.times++;
		this.reminds.update(remind);

		const friend = this.ai.lookupFriend(remind.userId);
		if (friend == null) return; // 処理の流れ上、実際にnullになることは無さそうだけど一応

		let reply;
		try {
			reply = await this.ai.post({
				renoteId: remind.thing == null && remind.quoteId ? remind.quoteId : remind.id,
				text: acct(friend.doc.user) + ' ' + serifs.reminder.notify(friend.name)
			});
		} catch (err) {
			// renote対象が消されていたらリマインダー解除
			if (err.statusCode === 400) {
				this.unsubscribeReply(remind.thing == null && remind.quoteId ? remind.quoteId : remind.id);
				this.reminds.remove(remind);
				return;
			}
			return;
		}

		this.subscribeReply(remind.id, reply.id, {
			id: remind.id
		});

		// タイマーセット
		this.setTimeoutWithPersistence(NOTIFY_INTERVAL, {
			id: remind.id,
		});
	}
}
