import Ajv from 'ajv';
import jwt from 'jsonwebtoken';
import { db } from './server';
import { authsecrekey } from './config';

export const ajv = new Ajv({ allErrors: true });
export const validateCredentials = ajv.compile({
    properties: {
        id: { type: 'number', minimum: 1 },
        email: { type: 'string', format: 'email' },
        password: { type: ['string', 'number'], minLength: 6 },
    },
    required: ['email', 'password'],
});

export async function authenticateUser(authkey: string): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let decoded: any;
    if (authkey !== undefined) {
        const bearer = authkey.split(' ');
        const token = bearer[1];
        if (token !== undefined) {
            decoded = jwt.verify(token, authsecrekey);
            const userCredentials = await db.get(
                'SELECT id, email, password FROM Users WHERE email = ?  AND id=?',
                decoded.email,
                decoded.id,
            );
            if (userCredentials !== undefined && decoded.password === userCredentials.password) {
                return decoded.id;
            }
        }
    }
    return 0;
}
