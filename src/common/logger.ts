require('dotenv').config()

import { createLogger, transports } from 'winston';
const { format } = require('logform');

export default createLogger({
    level: process.env.LOG_LEVEL ? process.env.LOG_LEVEL : "info",
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf((info: any) => {
                    const rawLevel = info.level.slice(5, 9);
                    const level = info.level.replace(rawLevel, rawLevel.toUpperCase())
        
                    let log = `[${level}]`;
                    if (info.social && info.user) {
                        log += " ";
                        log += `[${info.social} - ${info.user}]`
                    }
                    log += " ";
                    log += info.message.trim()
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
                        log += `[${info.social} - ${info.user}]`
                    }
                    log += " ";
                    log += info.message.trim()
                    return log;
                })
            ),
        }),
    ],
});