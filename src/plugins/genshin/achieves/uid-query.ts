import { GroupMessageEventData, PrivateMessageEventData } from "oicq";
import { osCharacterInfoPromise, characterInfoPromise, osDetailInfoPromise, detailInfoPromise } from "../utils/promise";
import { Redis } from "../../../bot";
import { render } from "../utils/render";

function getID( data: string ): [ number, string ] | string {
	const regex = new RegExp("^([1,5,6,7,8,9])[0-9]{8}$");
	if (data.length != 9 || !regex.test(data)) {
		return "输入 UID 不合法";
	}
	const uid: number = parseInt( data );
	var region: string;
	switch (data[0]) {
		case '1':
			region = 'cn_gf01';
			break;
		case '5':
			region = 'cn_qd01'
			break;
		case '6':
			region = 'os_usa'
			break;
		case '7':
			region = 'os_euro'
			break;
		case '8':
			region = 'os_asia'
			break;
		case '9':
			region = 'os_cht'
			break;
		default:
			region = 'invalid'
	}
	
	return [ uid, region ];
}

function isCNServer(data): boolean {
	if(data[0] === '1' || data[0] === '5')
		return true;
	return false;
}

type Message = GroupMessageEventData | PrivateMessageEventData;

async function main( sendMessage: ( content: string ) => any, message: Message ): Promise<void> {
	const data: string = message.raw_message;
	const qqID: number = message.user_id;
	const info: [ number, string ] | string = getID( data );
	
	if ( typeof info === "string" ) {
		await sendMessage( info );
		return;
	}
	
	try {
		await Redis.setHash( `silvery-star.card-data-${ qqID }`, {
			nickname: message.sender.nickname,
			uid: info[0],
			level: 0
		} );
		if (isCNServer(data)) {
			const detailInfo = await detailInfoPromise(qqID, ...info, false) as number[];
			await characterInfoPromise(qqID, ...info, detailInfo);
		} else {
			const detailInfo = await osDetailInfoPromise(qqID, info[0]) as number[];
			await osCharacterInfoPromise(qqID, info[0]);
		}
	} catch ( error ) {
		if ( error !== "gotten" ) {
			await sendMessage( error as string );
			return;
		}
	}
	const image: string = await render( "card", { qq: qqID } );
	await sendMessage( image );
}

export { main }