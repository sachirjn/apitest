import Koa from 'koa';
import Router from 'koa-router';
import sqlite from 'sqlite';
import koaBody from 'koa-bodyparser';
import jwt from 'jsonwebtoken';
import sqlString from 'sqlstring';

//server settings
const app = new Koa();
const PORT = process.env.PORT || 3000;
const router = new Router();
const authsecrekey = 'woahsosecured';

//Setup Db
let db: sqlite.Database;
async function connect(): Promise<void> {
    db = await sqlite.open('./database.sqlite');
}
async function migrate(): Promise<void> {
    await db.run(
        'CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, firstname STRING (50), lastname STRING (50), email STRING (100), password STRING (50))',
    );
}
const dbconres = connect();
dbconres.then(() => {
    migrate();
});

function authenticateUser(authkey: string): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let decoded: any;
    if (typeof authkey !== 'undefined') {
        const bearer = authkey.split(' ');
        const token = bearer[1];
        if (typeof token !== 'undefined' && token !== '') {
            decoded = jwt.verify(token, authsecrekey);
            if (typeof decoded !== 'undefined') {
                return decoded.id;
            }
        }
    }
    return 0;
}

//Routes
//create user
router.post('/api/users', koaBody(), async ctx => {
    const postBody = ctx.request.body;
    if (typeof postBody !== 'undefined') {
        if (
            postBody['email'] !== '' &&
            typeof postBody['email'] !== 'undefined' &&
            postBody['password'] !== '' &&
            typeof postBody['password'] !== 'undefined'
        ) {
            const res = await db.run(
                'INSERT INTO Users(firstname, lastname, email, password) VALUES(?,?,?,?)',
                postBody['firstname'],
                postBody['lastname'],
                postBody['email'],
                postBody['password'],
                (err: string) => {
                    if (err) {
                        ctx.response.status = 500;
                        console.log(err);
                    }
                },
            );
            if (res.lastID > 0) {
                const user = await db.get('SELECT id, email, firstname, lastname FROM Users WHERE id = ?', res.lastID);
                ctx.response.body = JSON.stringify(user);
            } else {
                ctx.response.status = 500;
            }
        } else {
            ctx.response.status = 400;
            ctx.response.body = JSON.stringify({
                message: 'email and password is required',
            });
        }
    } else {
        ctx.response.status = 400;
        ctx.response.body = JSON.stringify({
            message: 'No data received',
        });
    }
});
//authenticate
router.post('/api/auth', koaBody(), async ctx => {
    const postBody = ctx.request.body;
    if (typeof postBody !== 'undefined') {
        const userCredentials = await db.get(
            `SELECT id, email, password FROM Users WHERE email = ? AND password=?`,
            postBody['email'],
            postBody['password'],
        );
        if (typeof userCredentials !== 'undefined') {
            const token = jwt.sign(userCredentials, authsecrekey);
            ctx.response.body = {
                token: token,
            };
        } else {
            ctx.response.status = 400;
            ctx.response.body = JSON.stringify({
                message: 'Incorrect authentication credentials',
            });
        }
    } else {
        ctx.response.status = 400;
        ctx.response.body = JSON.stringify({
            message: 'No data received',
        });
    }
});
//get all users
router.get('/api/users', async ctx => {
    const authkey: string = ctx.request.headers['authorization'];
    const authorizedUID = authenticateUser(authkey);
    if (authorizedUID > 0) {
        const users = await db.all(`SELECT id, email, firstname, lastname FROM Users`);
        if (typeof users !== 'undefined') {
            ctx.response.body = JSON.stringify(users);
        } else {
            ctx.response.body = JSON.stringify({
                message: 'no results found',
            });
        }
    } else {
        ctx.response.status = 403;
    }
});
//get user
router.get('/api/users/:id', async ctx => {
    const authkey: string = ctx.request.headers['authorization'];
    const authorizedUID = authenticateUser(authkey);
    if (authorizedUID > 0) {
        ctx.response.status = 200;
        //search user
        const userRes = await db.get('SELECT id, email, firstname, lastname FROM Users WHERE id = ?', ctx.params.id);
        ctx.response.status = 200;
        if (typeof userRes !== 'undefined') {
            ctx.response.body = JSON.stringify(userRes);
        } else {
            ctx.response.body = JSON.stringify({
                message: 'user not found found',
            });
        }
    } else {
        ctx.response.status = 403;
    }
});
//update own data
router.patch('/api/users', koaBody(), async ctx => {
    const authkey: string = ctx.request.headers['authorization'];
    const authorizedUID = authenticateUser(authkey);
    if (authorizedUID > 0) {
        const postBody = ctx.request.body;
        let emailValidation = '';
        let setQ = '';
        const postKeys = Object.keys(postBody);
        postKeys.forEach(element => {
            if (setQ !== '') {
                setQ += ', ';
            }
            setQ += element + '=' + sqlString.escape(postBody[element]);
        });

        if (typeof postBody !== 'undefined') {
            if (!postBody['email']) {
                emailValidation = 'email is required';
            }
            if (emailValidation === '') {
                const query = sqlString.format(`UPDATE Users SET ${setQ} WHERE id=?`, [authorizedUID]);
                await db.run(query, (err: string) => {
                    if (err) {
                        ctx.response.status = 500;
                        console.log(err);
                    }
                });

                const user = await db.get('SELECT * FROM Users WHERE id = ?', authorizedUID);
                console.log(user);
                ctx.response.status = 200;
                ctx.response.body = JSON.stringify(user);
            } else {
                ctx.response.status = 400;
                ctx.response.body = JSON.stringify({
                    message: emailValidation,
                });
            }
        } else {
            ctx.response.status = 400;
            ctx.response.body = JSON.stringify({
                message: 'No data received',
            });
        }
    } else {
        ctx.response.status = 403;
    }
});

app.use(router.routes());

const server = app.listen(PORT, () => {
    console.log(`Server listening on port: ${PORT}`);
});

module.exports = server;
