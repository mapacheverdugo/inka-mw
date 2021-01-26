/**
 * @module 'winston-pg-native'
 * @fileoverview Winston transport for logging into PostgreSQL
 * @license MIT
 * @author Andrei Tretyakov <andrei.tretyakov@gmail.com>
 * @author Jeffrey Yang <jeffrey.a.yang@gmail.com>
 */

const { stringify } = require('flatted/cjs');
const moment = require('moment');
const {
  native: { Pool }
} = require('pg');
const sql = require('sql');
const { Stream } = require('stream');
const Transport = require('winston-transport');

/**
 * Class for the Postgres transport object.
 * @class
 * @param {Object} options
 * @param {String} [options.level=info] - Level of messages that this transport
 * should log.
 * @param {Boolean} [options.silent=false] - Boolean flag indicating whether to
 * suppress output.
 * @param {String} options.conString - Postgres connection uri
 * @param {String} [options.tableName='winston_logs'] - The name of the table you
 * want to store log messages in.
 * @param {Array} [options.tableFields=['level', 'msg', 'meta']] - array of the table fields
 * @param {String} [options.label] - Label stored with entry object if defined.
 * @param {String} [options.name] - Transport instance identifier. Useful if you
 * need to create multiple Postgres transports.
 */
class Postgres extends Transport {
  constructor(options: any = {}) {
    super(options);
    //
    // Name this logger
    //
    this.name = options.name || 'Postgres';
    //
    // Set the level from your options
    //
    this.level = options.level || 'info';

    this.silent = options.silent || false;

    // legacy
    const tableConfig = options.tableConfig ? options.tableConfig : {};

    const tableName = tableConfig.tableName || options.tableName || 'winston_logs';

    let tableFields = tableConfig.tableFields
      || options.tableFields || [
      {
        name: 'level',
        dataType: 'character varying'
      },
      {
        name: 'message',
        dataType: 'character varying'
      },
      {
        name: 'social',
        dataType: 'character varying'
      },
      {
        name: 'appkey',
        dataType: 'character varying'
      },
    ];

    tableFields = tableFields instanceof Array ? tableFields : tableFields.split(', ');

    tableFields.unshift({
      name: 'timestamp',
      dataType: 'timestamp without time zone'
    });

    this.table = sql.define({
      name: tableName,
      columns: tableFields
    });

    //
    // Configure storage
    //
    if (!options.conString && !options.connectionString) {
      throw new Error('You have to define conString or connectionString');
    }

    const poolConfig = Object.assign(options.poolConfig || {}, {
      connectionString: options.conString || options.connectionString || ''
    });

    this.pool = new Pool(poolConfig);
  }

  /**
   * Create logs table method.
   * @return {Promise} result of creation within a Promise
   */
  init() {
    const { table, pool } = this;

    return pool.connect().then((client: any) => client
      .query(
        table
          .create()
          .ifNotExists()
          .toQuery()
      )
      .then(() => client.release())
      .catch((e: any) => {
        client.release();
        throw e.stack;
      }));
  }

  /**
   * Core logging method exposed to Winston. Metadata is optional.
   * @param {string} level Level at which to log the message.
   * @param {string} message Message to log
   * @param {Object=} meta Metadata to log
   * @param {Function} callback Continuation to respond to when complete.
   */
  log(args: any, callback: any) {
    // const level = args.level;
    // const message = args.message;
    // const meta = args.meta;

    const { level, message, social, appKey } = args;
    if (!callback) {
      callback = () => {};
    }

    const { pool, table } = this;
    let { sqlStatement } = this;

    if (sqlStatement) {
      sqlStatement = {
        text: sqlStatement,
        values: ['now()', level, message, social, appKey]
      };
    }

    if (this.silent) {
      callback(null, true);
      return null;
    }
    
    return pool.connect().then((client: any) => {
      client
      .query(sqlStatement || table.insert(table.timestamp.value('NOW()'), table.level.value(level.toUpperCase()), table.message.value(message), table.social.value(social), table.appkey.value(appKey)).toQuery())
      .then(() => {
        client.release();
        this.emit('logged', args);
        callback(null, true);
        return null;
      })
      .catch((e: any) => {
        client.release();
        this.emit('error', e.stack);
        callback(e.stack);
        return null;
      });
    });
  }

  /**
   * Query the transport. Options object is optional.
   * @param {Object} options - Loggly-like query options for this instance.
   * @param {string} [options.from] - Start time for the search.
   * @param {string} [options.until=now] - End time for the search. Defaults to "now".
   * @param {string} [options.rows=100] - Limited number of rows returned by search. Defaults to 100.
   * @param {string} [options.order=desc] - Direction of results returned, either "asc" or "desc".
   * @param {string} [options.fields]
   * @param {Function} callback - Continuation to respond to when complete.
   */
  query(args: any, callback: any) {
    const options = args || {};

    if (!callback) {
      callback = () => {};
    }

    const { pool, table } = this;

    const fields = options && options.fields instanceof Array ? options.fields.map((field: string) => table[field]) : [table.star()];

    let query = table.select(...fields).from(table);

    if (options.from && options.until) {
      query = query.where(
        table.timestamp.between(
          moment(options.from)
            .utc()
            .toDate()
            .toUTCString(),
          moment(options.until)
            .utc()
            .toDate()
            .toUTCString()
        )
      );
    }

    if (options.order && options.order === 'desc') {
      query = query.order(table.timestamp.descending);
    }

    if (options.rows) {
      query = query.limit(options.rows);
    }

    query = query.toQuery();

    return pool.connect().then((client: any) => client
      .query(query)
      .then((result: any) => {
        const data = result && result.rows instanceof Array ? result.rows : [];
        client.release();
        callback(null, data);
        return null;
      })
      .catch((e: any) => {
        client.release();
        callback(e.stack);
        return null;
      }));
  }

  /**
   * Returns a log stream for this transport. Options object is optional.
   * @param {Object} options Stream options for this instance.
   * @param {Stream} stream Pass in a pre-existing stream.
   * @return {Stream}
   */
  stream(...args: any) {
    const options = args.shift() || {};
    const stream = args.shift() || new Stream();

    const { pool, table } = this;

    let start = typeof options.start === 'undefined' ? null : options.start;
    let row = 0;

    if (start === -1) {
      start = null;
    }

    stream.destroy = function destroy() {
      this.destroyed = true;
    };

    function poll(offset: any) {
      let query = table.select(table.star()).from(table);

      if (offset) {
        query = query.offset(offset);
      }

      query = query.toQuery();

      return pool.connect().then((client: any) => client
        .query(query)
        .then((result: any) => {
          client.release();

          if (stream.destroyed) {
            return null;
          }

          const rows = result && result.rows instanceof Array ? result.rows : [];
          rows.forEach((log: any) => {
            if (start === null || row > start) {
              stream.emit('log', log);
            }
            row += 1;
          });

          return setTimeout(poll, 2000);
        })
        .catch((e: any) => {
          client.release();

          if (stream.destroyed) {
            return null;
          }

          stream.emit('error', e.stack);

          return setTimeout(poll, 2000);
        }));
    }

    // we need to poll here.
    poll(start);

    return stream;
  }
}

module.exports = Postgres;