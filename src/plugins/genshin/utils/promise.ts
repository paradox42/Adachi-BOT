import { Adachi, Redis } from "../../../bot";
import { cookies } from "../init";
import { getBaseInfo, getCharactersInfo, getDetailInfo } from "./api";
import { omit } from "lodash";
import { GenshinKit } from "genshin-kit";

async function baseInfoPromise( qqID: number, mysID: number ): Promise<string | [ number, string ]> {
	const { retcode, message, data } = await getBaseInfo( mysID, cookies.get() );
	
	return new Promise( async ( resolve, reject ) => {
		if ( retcode !== 0 ) {
			reject( `米游社接口报错: ${ message }` );
			return;
		} else if ( !data.list || data.list.length === 0 ) {
			reject( "未查询到角色数据，请检查米哈游通行证（非UID）是否有误或是否设置角色信息公开" );
			return;
		}
		
		const genshinInfo: any = data.list.find( el => el.game_id === 2 );
		if ( !genshinInfo ) {
			reject( "未查询到角色数据，请检查米哈游通行证（非UID）是否有误或是否设置角色信息公开" );
			return;
		}
		
		const { game_role_id, nickname, region, level } = genshinInfo;
		const uid: number = parseInt( game_role_id );
		
		await Redis.setHash( `silvery-star.card-data-${ qqID }`, { nickname, uid, level } );
		resolve( [ uid, region ] );
	} );
}

async function osDetailInfoPromise(qqID: number, uid: number): Promise<string | number[]> {
	const app = new GenshinKit();
	app.setServerType("os");
	app.loginWithCookie(
		"UM_distinctid=17ac66ea2c8473-0107507431b156-1632685d-1aeaa0-17ac66ea2c98e3; _MHYUUID=9c7eda3e-57aa-4b2a-8602-b93dda57c317; _ga_9TTX3TE5YL=GS1.1.1627400720.2.0.1627400720.0; mi18nLang=en-us; login_ticket=h5DKjQmaIeg7Y0x2BLPB1CKW2tEuXS6VONls1aFO; account_id=29266033; cookie_token=47zY4CaDtJFyBE4XaYpeWHg1bgCKvGvuHYOxdrjz; ltoken=qW7zhvTb2DYk1C1mNk4gk0hUgdl4RkHmnNMNMc8f; ltuid=29266033; _ga_54PBK3QDF4=GS1.1.1631398184.4.0.1631398184.0; _ga=GA1.2.247711736.1626826770; _gid=GA1.2.1128788684.1631398185; _gat_gtag_UA_201411121_1=1"
	);

	const detail: any = await Redis.getHash(`silvery-star.card-data-${qqID}`);
	if (detail.stats !== undefined && uid === parseInt(detail.stats.uid)) {
		Adachi.logger.info(`用户 ${uid} 在一小时内进行过查询操作，将返回上次数据`);
		return Promise.reject("gotten");
	}
	var data;
	try {
		data = await app.getUserInfo(uid);
	}
	catch (error) {
		data = error;
	}

	return new Promise(async (resolve, reject) => {
		if (data.code) {
			return reject(`api error: ${data.message}`);
		}
		else {
			await Redis.setHash(`silvery-star.card-data-${qqID}`, {
				explorations: JSON.stringify(data.world_explorations),
				stats: JSON.stringify(data.stats),
				homes: JSON.stringify(data.homes),
			});
			await Redis.setTimeout(`silvery-star.card-data-${qqID}`, 3600);
			Adachi.logger.info(`用户 ${uid} 查询成功，数据已缓存`);

			const charIDs: number[] = data.avatars.map((el) => el.id);
			return resolve(charIDs);
		}
	});
}

async function osCharacterInfoPromise(qqID: number, uid: number): Promise<string | void> {
	const app = new GenshinKit();
	app.setServerType("os");
	app.loginWithCookie(
		"UM_distinctid=17ac66ea2c8473-0107507431b156-1632685d-1aeaa0-17ac66ea2c98e3; _MHYUUID=9c7eda3e-57aa-4b2a-8602-b93dda57c317; _ga_9TTX3TE5YL=GS1.1.1627400720.2.0.1627400720.0; mi18nLang=en-us; login_ticket=h5DKjQmaIeg7Y0x2BLPB1CKW2tEuXS6VONls1aFO; account_id=29266033; cookie_token=47zY4CaDtJFyBE4XaYpeWHg1bgCKvGvuHYOxdrjz; ltoken=qW7zhvTb2DYk1C1mNk4gk0hUgdl4RkHmnNMNMc8f; ltuid=29266033; _ga_54PBK3QDF4=GS1.1.1631398184.4.0.1631398184.0; _ga=GA1.2.247711736.1626826770; _gid=GA1.2.1128788684.1631398185; _gat_gtag_UA_201411121_1=1"
	);
	const data = await app.getAllCharacters(uid);
	return new Promise(async (resolve, reject) => {
		if (data) {
			let avatars: any[] = [];
			const charList: any[] = data;
			for (let char of charList) {
				const base: any = omit(char, ["image", "weapon", "reliquaries", "constellations"]);
				const weapon: any = omit(char.weapon, ["id", "type", "promote_level", "type_name"]);

				let artifacts: any[] = [];

				for (let pos of char.reliquaries) {
					const posInfo: any = omit(pos, ["id", "set", "pos_name"]);
					artifacts.push(posInfo);
				}
				avatars.push({ ...base, weapon, artifacts });
			}

			await Redis.setHash(`silvery-star.card-data-${qqID}`, {
				avatars: JSON.stringify(avatars)
			});
			resolve();
		}
		else {
			reject("rejected promise in osCharacterInfoPromise");
		}
	});
}

async function detailInfoPromise( qqID: number, uid: number, server: string, flag: boolean ): Promise<string | number[]> {
	const detail: any = await Redis.getHash( `silvery-star.card-data-${ qqID }` );
	
	if ( flag && detail.stats !== undefined && uid === parseInt( detail.stats.uid ) ) {
		Adachi.logger.info( `用户 ${ uid } 在一小时内进行过查询操作，将返回上次数据` );
		return Promise.reject( "gotten" );
	}
	
	const { retcode, message, data } = await getDetailInfo( uid, server, cookies.get() );
	cookies.increaseIndex();
	
	return new Promise( async ( resolve, reject ) => {
		if ( retcode !== 0 ) {
			reject( `detail: 米游社接口报错: ${ message }` );
			return;
		}
		
		await Redis.setHash( `silvery-star.card-data-${ qqID }`, {
			explorations:   JSON.stringify( data.world_explorations ),
			stats:          JSON.stringify( data.stats ),
			homes:          JSON.stringify( data.homes )
		} );
		await Redis.setTimeout( `silvery-star.card-data-${ qqID }`, 3600 );
		Adachi.logger.info( `用户 ${ uid } 查询成功，数据已缓存` );
		
		const charIDs: number[] = data.avatars.map( el => el.id );
		resolve( charIDs );
	} );
}

async function characterInfoPromise( qqID: number, uid: number, server: string, charIDs: number[] ): Promise<string | void> {
	const { retcode, message, data } = await getCharactersInfo( uid, server, charIDs, cookies.get() );
	cookies.increaseIndex();

	return new Promise( async ( resolve, reject ) => {
		if ( retcode !== 0 ) {
			reject( `character 米游社接口报错: ${ message }` );
			return;
		}
		
		let avatars: any[] = [];
		const charList: any[] = data.avatars;
		for ( let char of charList ) {
			const base: any = omit( char, [ "image", "weapon", "reliquaries", "constellations" ] );
			const weapon: any = omit( char.weapon, [ "id", "type", "promote_level", "type_name" ] );
			
			let artifacts: any[] = [];

			for ( let pos of char.reliquaries ) {
				const posInfo: any = omit( pos, [ "id", "set", "pos_name" ] );
				artifacts.push( posInfo );
			}
			
			avatars.push( { ...base, weapon, artifacts } );
		}
		
		await Redis.setHash( `silvery-star.card-data-${ qqID }`, {
			avatars: JSON.stringify( avatars )
		} );
		resolve();
	} );
}

export {
	baseInfoPromise,
	detailInfoPromise,
	characterInfoPromise,
	osDetailInfoPromise,
	osCharacterInfoPromise
}
