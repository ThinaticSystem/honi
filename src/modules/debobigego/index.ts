import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import includes from '@/utils/includes';

export default class extends Module {
	public readonly name = 'debobigego';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		let debo_msg = ""; //Honi says this
		//random number generator
		//reffered https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
		function randomIntFromInterval(min, max) { // min and max included 
			return Math.floor(Math.random() * (max - min + 1) + min);
		}

		if (msg.text && includes(msg.text, ['デボビゲゴ', 'debobigego'])) {
			// Katakana range: 12449-12538, 65382-65391, 65393-65437
			// long vowel: 12540

			// 0文字目（長音が先に来るのは流石におかしいので）
			debo_msg += String.fromCharCode(randomIntFromInterval(12449, 12538));
			// 1-4文字目
			for(let i=1; i<5; i++){
				switch (Math.floor(Math.random()*2)){
					case 0:
						debo_msg += String.fromCharCode(randomIntFromInterval(12449, 12538));
						break;
					case 1:
						debo_msg += "ー";
						break;
				}

			}
			
			msg.reply(debo_msg, {
				immediate: true
			});
			return true;
		} else {
			return false;
		}
	}
}
