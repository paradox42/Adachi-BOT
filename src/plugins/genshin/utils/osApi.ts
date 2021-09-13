import { GenshinKit } from "genshin-kit";
async function getOSBaseInfo(uid): Promise<any> {
    const app = new GenshinKit();
    app.setServerType("os");
    app.loginWithCookie(
        "UM_distinctid=17ac66ea2c8473-0107507431b156-1632685d-1aeaa0-17ac66ea2c98e3; _MHYUUID=9c7eda3e-57aa-4b2a-8602-b93dda57c317; _ga_9TTX3TE5YL=GS1.1.1627400720.2.0.1627400720.0; mi18nLang=en-us; login_ticket=h5DKjQmaIeg7Y0x2BLPB1CKW2tEuXS6VONls1aFO; account_id=29266033; cookie_token=47zY4CaDtJFyBE4XaYpeWHg1bgCKvGvuHYOxdrjz; ltoken=qW7zhvTb2DYk1C1mNk4gk0hUgdl4RkHmnNMNMc8f; ltuid=29266033; _ga_54PBK3QDF4=GS1.1.1631398184.4.0.1631398184.0; _ga=GA1.2.247711736.1626826770; _gid=GA1.2.1128788684.1631398185; _gat_gtag_UA_201411121_1=1"
    );
    return new Promise((reject, resolve) => {
        app.getUserInfo(uid)
            .then(result => {
                resolve(result);
            }).catch(reason => {
                reject(reason);
            });
    });
}


export {
    getOSBaseInfo
};