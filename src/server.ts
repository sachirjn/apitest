import Koa from 'koa';
import koaBody from 'koa-bodyparser';
import { setRoutes } from './routes';
import { dbCon } from './database';
import sqlite from 'sqlite';

//server settings
const app = new Koa();
const PORT = process.env.PORT || 3000;

//Set Db
export let db: sqlite.Database;
function setDb(dbRes: sqlite.Database): void {
    db = dbRes;
}
dbCon.then(async result => {
    setDb(result);
});

//Set Routes
const router = setRoutes();
app.use(koaBody());
app.use(router.routes());

export const server = app.listen(PORT, () => {
    console.log(`Server listening on port: ${PORT}`);
});
