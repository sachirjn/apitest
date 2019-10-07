import Router from 'koa-router';
import jwt from 'jsonwebtoken';
import sqlString from 'sqlstring';
import bcrypt from 'bcrypt';
import { validateCredentials, ajv, authenticateUser } from './validation';
import { db } from './server';
import { authsecrekey } from './config';

export function setRoutes(): Router {
    const router = new Router();
    router.post('/api/users', async ctx => {
        const postBody = ctx.request.body;
        if (!validateCredentials(postBody)) {
            ctx.response.status = 400;
            ctx.response.body = JSON.stringify({
                message: ajv.errorsText(validateCredentials.errors),
            });
            return;
        }
        const emailExist = await db.get('SELECT email FROM Users WHERE email = ?', postBody.email);
        if (emailExist === undefined) {
            const pwdhash = bcrypt.hashSync(postBody.password, 10);
            const res = await db.run(
                'INSERT INTO Users(firstname, lastname, email, password) VALUES(?,?,?,?)',
                postBody.firstname,
                postBody.lastname,
                postBody.email,
                pwdhash,
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
                message: 'Email is already taken.',
            });
        }
    });
    //authenticate
    router.post('/api/auth', async ctx => {
        const postBody = ctx.request.body;
        if (postBody !== undefined) {
            const userCredentials = await db.get(
                `SELECT id, email, password FROM Users WHERE email = ?`,
                postBody.email,
            );
            const pwdCheck = bcrypt.compareSync(postBody.password, userCredentials.password);
            if (userCredentials !== undefined && pwdCheck) {
                const token = jwt.sign(userCredentials, authsecrekey);
                ctx.response.status = 200;
                ctx.response.body = {
                    token: token,
                };
            } else {
                ctx.response.status = 400;
                ctx.response.body = JSON.stringify({
                    message: 'Invalid login',
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
        const authorizedUID = await authenticateUser(authkey);
        if (authorizedUID > 0) {
            const users = await db.all('SELECT id, email, firstname, lastname  FROM Users');
            ctx.response.status = 200;
            ctx.response.body = JSON.stringify(users);
        } else {
            ctx.response.status = 403;
        }
    });
    //get user
    router.get('/api/users/:id', async ctx => {
        const authkey: string = ctx.request.headers['authorization'];
        const authorizedUID = await authenticateUser(authkey);
        if (authorizedUID > 0) {
            const userRes = await db.get(
                'SELECT id, email, firstname, lastname FROM Users WHERE id = ?',
                ctx.params.id,
            );
            ctx.response.status = 200;
            ctx.response.body = userRes !== undefined ? JSON.stringify(userRes) : {};
        } else {
            ctx.response.status = 403;
        }
    });

    //update own data
    router.patch('/api/users', async ctx => {
        const postBody = ctx.request.body;
        let message = '';
        if (postBody === undefined) {
            ctx.response.status = 400;
            ctx.response.body = JSON.stringify({
                message: ajv.errorsText(validateCredentials.errors),
            });
            return;
        }
        const authkey: string = ctx.request.headers['authorization'];
        const authorizedUID = await authenticateUser(authkey);
        if (authorizedUID > 0) {
            let setQ = '';
            const postKeys = Object.keys(postBody);
            postKeys.forEach(element => {
                if (setQ !== '') {
                    setQ += ', ';
                }
                postBody[element] = element === 'password' ? bcrypt.hashSync(postBody.password, 10) : postBody[element];
                setQ += element + '=' + sqlString.escape(postBody[element]);
            });

            if (postBody.password !== undefined || postBody.email !== undefined) {
                message = 'You have successfully changed your password/email. Please login again.';
            }
            const query = sqlString.format(`UPDATE Users SET ${setQ} WHERE id=?`, [authorizedUID]);
            await db.run(query);
            const user = await db.get('SELECT id, email, firstname, lastname FROM Users WHERE id = ?', authorizedUID);
            ctx.response.status = 200;
            ctx.response.body = JSON.stringify({ user: user, message: message });
        } else {
            ctx.response.status = 403;
        }
    });

    return router;
}
