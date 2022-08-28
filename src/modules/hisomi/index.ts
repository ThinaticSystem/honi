import autobind from 'autobind-decorator';

import { Note } from '@/misskey/note';
import Module from '@/module';
import Stream from '@/stream';
import * as loki from 'lokijs';

export default class extends Module {
	public readonly name = 'hisomi';

	private htl: ReturnType<Stream['useSharedConnection']>;
	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	@autobind
	public install() {
		this.htl = this.ai.connection.useSharedConnection('homeTimeline');
		this.htl.on('note', this.onNote);
		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId'],
		});

		return {};
	}

	@autobind
	private async onNote(note: Note) {
		if (note.reply != null) return;
		if (note.text == null) return;
	}
}
