import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
const gomamayo = require('gomamayo-js');

export default class extends Module {
	public readonly name = 'gomamayo-debug';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text && msg.text.includes('ゴママヨ')) {
			const gomamayoResult = await gomamayo.find(msg.text.replace(/ゴママヨ/g, ''));
			const resText = gomamayoResult ? `ゴママヨかも\n${JSON.stringify(gomamayoResult, undefined, 2)}` : 'ゴママヨじゃないかも';
			msg.reply(resText, {
				immediate: true
			});
			return true;
		} else {
			return false;
		}
	}
}
