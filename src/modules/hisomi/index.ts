import autobind from 'autobind-decorator';

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
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
		learnedKeywords.data.forEach(async (learnedKeyword) => {
			this.learnedKeywordsTokens.push((await mecab(learnedKeyword.keyword, config.mecab, config.mecabDic)));
		});

		return {};
	}

	@autobind
	private async onNote(note: Note) {
		if (note.reply != null) return;
		if (note.text == null) return;
		if (note.text.includes('潜む')) return;

		const noteTokens = await mecab(note.text, config.mecab, config.mecabDic);
		const noteRuby = noteTokens.flatMap(token => token[9]).join('');

		let foundHisomi:
			{
				word: string,
				noteTokenIndexes: number[],
			}
			| undefined;

		learnedKeywordsLoop:
		for (const learnedKeywordTokens of this.learnedKeywordsTokens) {
			// 1単語でも2つ以上のトークンに解釈されている可能性があるため結合する
			const hisomiWordRuby = learnedKeywordTokens.flatMap(token => token[9]).join('');

			// 2文字潜みはダサいので抜ける
			if (hisomiWordRuby.length < 3) {
				continue;
			}
			// 含まれない場合抜ける
			if (!noteRuby.includes(hisomiWordRuby)) {
				continue;
			}
			// トークンをまたいで潜んでいない場合抜ける
			if (noteTokens.find(token => token[9]?.includes(hisomiWordRuby))) {
				continue;
			}

			//// 潜みの検出
			// マッチするとマッチした文字が先頭から消費される
			let consumableHisomiWordRuby = hisomiWordRuby;
			// 潜みを構成するnoteTokensのトークンインデックスをメモする配列
			const noteTokenHisomingTokenIndexes: number[] = [];

			let noteTokenIndex = -1;
			for (const noteToken of noteTokens) {
				noteTokenIndex++;

				// 1文字づつ減らして部分マッチを試行
				for (let len = consumableHisomiWordRuby.length; len > 0; len--) {
					const target = (() => {
						// トークンの頭から潜む場合はマッチさせない
						if (len === consumableHisomiWordRuby.length) {
							return noteToken[9].slice(1);
						}
						return noteToken[9];
					})();
					if (target?.includes(consumableHisomiWordRuby.slice(0, len))) {
						// 部分マッチに成功した部分を消費
						consumableHisomiWordRuby = consumableHisomiWordRuby.slice(len);

						noteTokenHisomingTokenIndexes.push(noteTokenIndex);

						// 既に潜みトークンの完全マッチが終わっていれば最終処理
						if (consumableHisomiWordRuby.length === 0) {
							foundHisomi = {
								word: learnedKeywordTokens.flatMap(token => token[0]).join(''),
								noteTokenIndexes: noteTokenHisomingTokenIndexes,
							};
							break learnedKeywordsLoop;
						}

						continue;
					}
				}

				// 部分マッチ失敗なので消費をリセット
				consumableHisomiWordRuby = hisomiWordRuby;
				// 部分マッチ失敗なので潜みトークンインデックスをリセット
				noteTokenHisomingTokenIndexes.splice(0);
			}
		}

		if (!foundHisomi) {
			return;
		}

		const hisomingText = noteTokens.filter((_v, i) => foundHisomi?.noteTokenIndexes.includes(i)).flatMap(token => token[0]).join('');
		this.ai.post({
			text: `${hisomingText}に潜む、${foundHisomi.word}`,
		});
	}
}
