import autobind from 'autobind-decorator';
import { parse } from 'twemoji-parser';
const delay = require('timeout-as-promise');

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
import includes from '@/utils/includes';
import config from '@/config';
const gomamayo = require('gomamayo-js');

export default class extends Module {
	public readonly name = 'emoji-react';

	private htl: ReturnType<Stream['useSharedConnection']>;

	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection('homeTimeline');
		this.htl.on('note', this.onNote);

		return {};
	}

	@autobind
	private async onNote(note: Note) {
		if (note.reply != null) return;
		if (note.text == null) return;
		if (note.text.includes('@')) return; // (自分または他人問わず)メンションっぽかったらreject

		const react = async (reaction: string, immediate = false) => {
			if (!immediate) {
				await delay(1500);
			}
			this.ai.api('notes/reactions/create', {
				noteId: note.id,
				reaction: reaction
			});
		};
		
		let gomamayoSafe = note.text;
		for (const ignore of config.gomamayoIgnoreWords ? config.gomamayoIgnoreWords : []) {
			gomamayoSafe = gomamayoSafe.replace(ignore, '');
		}
		if (await gomamayo.find(gomamayoSafe)) return react(':gomamayo:');
		if (includes(note.text, ['漏れそう','もれそう'])) return react(':yattare:');
		if (includes(note.text, ['サイゼリア'])) return react(':police_saizeriya:');
		if (includes(note.text, ['ほに', 'honi'])) return react(':honi:');
		if (includes(note.text, ['藍'])) return react('🙌');
		if (includes(note.text, ['ふむ'])) return react('🐾');
		if (includes(note.text, ['寿司', 'sushi']) || note.text === 'すし') return react('🍣');
		if (includes(note.text, ['ぷりん'])) return react('🍮');
		if (includes(note.text, ['ぴざ'])) return react('🍕');
		if (includes(note.text, ['pdf', 'ＰＤＦ', 'ｐｄｆ', 'PDF'])) return react(':pdf:');
		if (includes(note.text, ['どこ'])) return react(':kanneiyahataseitetsusyo:');
		if (note.text.match(/(?<!お)う[～|ー]*んこ/)) return react(':anataima_unkotte_iimashitane:');
		
		const customEmojis = note.text.match(/:([a-z0-9_+-]+):/gi);
		if (customEmojis) {
			// カスタム絵文字が複数種類ある場合はキャンセル
			if (!customEmojis.every((val, i, arr) => val === arr[0])) return;
			if(customEmojis[0] == ':moresou:') return react(':yattare:');
			this.log(`Custom emoji detected - ${customEmojis[0]}`);

			return react(customEmojis[0]);
		}

		// 「カタカナが多すぎる」
		let kataCount = 0;
		for (let i = 0; i < note.text.length; i++) {
			if ((note.text.charCodeAt(i) >= 12449 && note.text.charCodeAt(i) <= 12538) || (note.text.charCodeAt(i) >= 65382 && note.text.charCodeAt(i) <= 65437 && note.text.charCodeAt(i) != 65392)) {
				kataCount++;
				if (kataCount >= 12) {
					return react(':too_many_katakana:');
				}
			} else if ((note.text.charCodeAt(i) === 12539) || ((kataCount === 0) ? false : note.text.charCodeAt(i) === 12540)) { // "・", "ー"はノーカウント
			} else if ((note.text.charCodeAt(i) === 65438) || (note.text.charCodeAt(i) === 65439)) { // "ﾞ", "ﾟ"はノーカウント（モーラ判定対応時に吹き飛ばすコード）
			} else {
				kataCount = 0;
			}
		}
		const emojis = parse(note.text).map(x => x.text);
		if (emojis.length > 0) {
			// 絵文字が複数種類ある場合はキャンセル
			if (!emojis.every((val, i, arr) => val === arr[0])) return;

			this.log(`Emoji detected - ${emojis[0]}`);

			let reaction = emojis[0];

			switch (reaction) {
				case '✊': case '👊': return react('✌', true);
				case '✌': return react('✋', true);
				case '🖐': case '✋': return react('✊', true);
			}

			return react(reaction);
		}
	}
}
