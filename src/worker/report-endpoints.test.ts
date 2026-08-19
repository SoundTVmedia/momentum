import { describe, expect, it } from 'vitest';
import { reportComment } from './report-endpoints';

type Statement = {
  sql: string;
  args: unknown[];
  firstResult?: unknown;
  runCalls: number;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function makeDb(statements: Statement[]): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          const statement = statements.find(
            (candidate) =>
              normalized(candidate.sql) === normalized(sql) &&
              JSON.stringify(candidate.args) === JSON.stringify(args),
          );
          return {
            async first() {
              return statement?.firstResult ?? null;
            },
            async run() {
              if (statement) statement.runCalls += 1;
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('reportComment', () => {
  it('creates a moderation flag and quarantines every reported comment', async () => {
    const statements: Statement[] = [
      {
        sql: 'SELECT id, mocha_user_id, clip_id FROM comments WHERE id = ?',
        args: ['42'],
        firstResult: { id: 42, mocha_user_id: 'author-1', clip_id: 9 },
        runCalls: 0,
      },
      {
        sql: 'SELECT id FROM comment_flags WHERE comment_id = ? AND reported_by = ?',
        args: ['42', 'reporter-1'],
        firstResult: null,
        runCalls: 0,
      },
      {
        sql: `INSERT INTO comment_flags (comment_id, reported_by, reason, details, status, is_urgent, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: ['42', 'reporter-1', 'spam', null, 0],
        runCalls: 0,
      },
      {
        sql: 'UPDATE comments SET is_hidden = 1 WHERE id = ?',
        args: [42],
        runCalls: 0,
      },
    ];

    const context = {
      get: (key: string) => (key === 'user' ? { id: 'reporter-1' } : undefined),
      req: {
        json: async () => ({ reason: 'spam' }),
        param: (key: string) => (key === 'commentId' ? '42' : ''),
      },
      env: { DB: makeDb(statements) },
      json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }),
    } as unknown as Parameters<typeof reportComment>[0];

    const response = (await reportComment(context)) as unknown as {
      body: { success: boolean };
      status: number;
    };

    expect(response).toEqual({
      body: { success: true, authorId: 'author-1' },
      status: 201,
    });
    expect(statements[2]?.runCalls).toBe(1);
    expect(statements[3]?.runCalls).toBe(1);
  });
});
