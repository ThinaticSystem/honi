import autobind from 'autobind-decorator';

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
import * as loki from 'lokijs';
import config from '@/config';
import { mecab } from '../keyword/mecab';

type MecabToken = string[];
type MecabTokens = MecabToken[];

export default class extends Module {
	public readonly name = 'hisomi';

	private htl: ReturnType<Stream['useSharedConnection']>;
	private learnedKeywordsTokens: MecabTokens[] = [];

	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection('homeTimeline');
		this.htl.on('note', this.onNote);

		const learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId'],
		});
		// 覚えてる単語の読みを生成
		learnedKeywords.data.forEach(learnedKeyword => {
			this.learnedKeywordsTokens.push((await mecab(learnedKeyword.keyword, config.mecab, config.mecabDic)));
		});

		return {};
	}

	@autobind
	private async onNote(note: Note) {
		if (note.reply != null) return;
		if (note.text == null) return;

		const noteTokens = await mecab(note.text, config.mecab, config.mecabDic);
		const noteRuby = noteTokens.flatMap(token => token[9]).join('');

		let foundHisomi:
			{
				word: string,
				noteTokenIndexes: number[],
			}
			| null
			= null;

		this.learnedKeywordsTokens.forEach(learnedKeywordTokens => {
			// 既に潜みを見つけていたら中断
			if (foundHisomi) {
				return;
			}

			// 1単語でも2つ以上のトークンに解釈されている可能性があるため結合する
			const hisomiWordRuby = learnedKeywordTokens.flatMap(token => token[9]).join('');

			// 含まれない場合抜ける
			if (!noteRuby.includes(hisomiWordRuby)) {
				return;
			}
			// トークンをまたいで潜んでいない場合抜ける
			if (noteTokens.find(token => token[9] === hisomiWordRuby)) {
				return;
			}

			//// 潜みの検出
			// マッチするとマッチした文字が先頭から消費される
			let consumableHisomiWordRuby = hisomiWordRuby;
			// 潜みを構成するnoteTokensのトークンインデックスをメモする配列
			const noteTokenHisomingTokenIndexes: number[] = [];

			noteTokens.forEach((noteToken, noteTokenIndex) => {
				// 既に潜みトークンの完全マッチが終わっていればスキップ
				if (consumableHisomiWordRuby.length === 0) {
					foundHisomi = {
						word: learnedKeywordTokens.flatMap(token => token[0]).join(''),
						noteTokenIndexes: noteTokenHisomingTokenIndexes,
					};
					return;
				}

				// 1文字づつ減らして部分マッチを試行
				for (let len = consumableHisomiWordRuby.length; len > 0; len--) {
					if (noteToken[9].includes(consumableHisomiWordRuby.slice(0, len))) {
						// 部分マッチに成功した部分を消費
						consumableHisomiWordRuby = consumableHisomiWordRuby.slice(len);

						noteTokenHisomingTokenIndexes.push(noteTokenIndex);
						return;
					}
				}
				// 部分マッチ失敗なので消費をリセット
				consumableHisomiWordRuby = hisomiWordRuby;
				// 部分マッチ失敗なので潜みトークンインデックスをリセット
				noteTokenHisomingTokenIndexes.splice(0);
			});
		});

		if (!foundHisomi) {
			return;
		}

		const hisomingText = noteTokens.filter((_v, i) => foundHisomi?.noteTokenIndexes.includes(i)).flatMap(token => token[9]).join('');
		this.ai.post({
			text: `${hisomingText}に潜む、${foundHisomi.word}`
		});
	}
}
