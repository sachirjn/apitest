import chai from 'chai';
import chaiHttp from 'chai-http';
import sqlite from 'sqlite';
import { server } from '../src/server';
import { dbname } from '../src/config';

const { expect } = chai;
chai.use(chaiHttp);

let token = '';
let userTestID = 0;
let totalUsers: Promise<number>;
let db: sqlite.Database;
async function connect(): Promise<void> {
    db = await sqlite.open(dbname);
}
async function getAllUsers(): Promise<number> {
    const users = await db.all(`SELECT id, email, password, firstname, lastname FROM Users`);
    return Object.keys(users).length;
}
async function deleteTestUser(id: number): Promise<void> {
    await db.run('DELETE FROM Users WHERE id=' + id);
}
connect();

describe('Check Authentication and User Endpoints', () => {
    it('Create User', done => {
        chai.request(server)
            .post('/api/users')
            .send({
                email: 'test@example.com',
                password: 'test123',
                firstname: 'Test',
                lastname: 'Unit',
            })
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(200);
                expect(jsonRes.id).to.not.equal(null);
                expect(jsonRes.email).to.equals('test@example.com');
                expect(jsonRes.firstname).to.equals('Test');
                expect(jsonRes.lastname).to.equals('Unit');
                userTestID = jsonRes.id;
                done();
            });
    });
    it('Invalid login', done => {
        chai.request(server)
            .post('/api/auth')
            .send({ email: 'test@example.com', password: 'sdasdasd123' })
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(400);
                expect(jsonRes.message).to.equals('Invalid login');
                done();
            });
    });
    it('Correct Login', done => {
        chai.request(server)
            .post('/api/auth')
            .send({ email: 'test@example.com', password: 'test123' })
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(200);
                expect(jsonRes.token).to.not.equal(null);
                token = 'Bearer ' + jsonRes.token;
                done();
            });
    });
    it('Get User', done => {
        chai.request(server)
            .get('/api/users/' + userTestID)
            .set('authorization', token)
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(200);
                expect(jsonRes.id).to.equals(userTestID);
                done();
            });
    });
    it('Get User Failed', done => {
        chai.request(server)
            .get('/api/users/100')
            .set('authorization', token)
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(200);
                expect(jsonRes).to.not.equal(null);
                done();
            });
    });
    it('Get Users', done => {
        chai.request(server)
            .get('/api/users')
            .set('authorization', token)
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(200);
                totalUsers = getAllUsers();
                totalUsers.then((result: number) => {
                    expect(Object.keys(jsonRes).length).to.equals(result);
                });
                done();
            });
    });
    it('Patch User', done => {
        chai.request(server)
            .patch('/api/users')
            .set('authorization', token)
            .send({
                email: 'testnew@example.com',
                password: 'password123',
                firstname: 'First Name',
                lastname: 'Last Name',
            })
            .end((err, res) => {
                const jsonRes = JSON.parse(res.text);
                expect(res).to.have.status(200);
                expect(jsonRes.user.firstname).to.equals('First Name');
                expect(jsonRes.user.lastname).to.equals('Last Name');
                expect(jsonRes.message).to.equals(
                    'You have successfully changed your password/email. Please login again.',
                );
                done();
            });
    });
}).afterAll(() => {
    if (userTestID > 0) {
        deleteTestUser(userTestID);
    }
});
