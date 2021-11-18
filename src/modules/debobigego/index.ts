import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';

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
		let debo_msg; //Honi says this
		//random number generator
		//reffered https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
		function randomIntFromInterval(min, max) { // min and max included 
			return Math.floor(Math.random() * (max - min + 1) + min);
		}

		if (msg.text && msg.text.includes('デボビゲゴ')) {
			// Katakana range: 12449-12538, 65382-65391, 65393-65437
			// long vowel: 12540
			let i;
			for(i=0; i<5; i++){
				switch (Math.floor(Math.random()*4)){
					case 1:
						debo_msg += String.fromCharCode(randomIntFromInterval(12449, 12538));
						break;
					case 2:
						debo_msg += String.fromCharCode(randomIntFromInterval(65382, 65391));
						break;
					case 3:
						debo_msg += String.fromCharCode(randomIntFromInterval(65393, 65437));
						break;
					case 4:
						debo_msg += "ー";
						break;
					default:
						break;
				}

			}
			
			//warranty for 0-chars
			if(!debo_msg){
				debo_msg=':deltu:';
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
