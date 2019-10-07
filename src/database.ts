import sqlite from 'sqlite';
import { dbname } from './config';

async function migrate(dbconres: sqlite.Database): Promise<void> {
    await dbconres.run(
        'CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY AUTOINCREMENT, firstname STRING (50), lastname STRING (50), email STRING (100), password STRING (50))',
    );
}
export const dbCon = sqlite.open(dbname).then(result => {
    migrate(result);
    return result;
});
