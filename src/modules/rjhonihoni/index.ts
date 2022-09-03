import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import includes from '@/utils/includes';

export default class extends Module {
	public readonly name = 'rjhonihoni';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
        let rj_regexp = new RegExp(/(RJ[0-9]+)/);

		if (msg.text && includes(msg.text, ['#RJほにほに']) && rj_regexp.test(msg.text)) {

            let rj_number = msg.text.replace(rj_regexp, '$1');
            let rj_url = "ほい\nhttps://www.dlsite.com/maniax/work/=/product_id/" + rj_number + ".html";

			msg.reply(rj_url, {
				immediate: true
			});
			return true;
		} else {
			return false;
		}
	}
}
