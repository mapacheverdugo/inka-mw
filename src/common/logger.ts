require('dotenv').config()

import { createLogger, transports } from 'winston';
import { format } from 'logform';

const Postgres = require('@pauleliet/winston-pg-native');

export default createLogger({
    level: process.env.LOG_LEVEL ? process.env.LOG_LEVEL : "info",
    transports: [
        /* new Postgres({
            connectionString: `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
            level: 'warn',
            poolConfig: {
              connectionTimeoutMillis: 0,
              idleTimeoutMillis: 0,
              max: 10
            },
            tableName: 'winston_logs'
        }), */
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf((info: any) => {
                    const rawLevel = info.level.slice(5, -5);
                    const level = info.level.replace(rawLevel, rawLevel.toUpperCase());
        
                    let log = `[${level}]`;
                    if (info.social && info.user) {
                        log += " ";
                        log += `[${info.social} - ${info.user}]`;
                    }
                    log += " ";
                    log += info.message.toString().trim();
                    return log;
                })
            ),
        }),
        new transports.File({
            filename: 'main.log',
            format: format.combine(
                format.timestamp(),
                format.printf((info: any) => {
                    let log = `${info.timestamp} [${info.level.toUpperCase()}]`;
                    if (info.social && info.user) {
                        log += " ";
                        log += `[${info.social} - ${info.user}]`;
                    }
                    log += " ";
                    log += info.message.toString().trim()
                    return log;
                })
            )
        })
    ]
});
