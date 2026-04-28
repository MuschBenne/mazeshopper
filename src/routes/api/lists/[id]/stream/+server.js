import { getSessionUser } from '$lib/server/session';
import { serializeList } from '$lib/server/utils';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const config = { maxDuration: 300 };

export async function GET({ params, cookies, request }) {
    const username = await getSessionUser(cookies);
    if (!username) return new Response('Unauthorized', { status: 401 });
    if (!ObjectId.isValid(params.id)) return new Response('Not found', { status: 404 });

    const db = await getDb();
    const doc = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        $or: [{ owner: username }, { sharedWith: username }]
    });
    if (!doc) return new Response('Forbidden', { status: 403 });

    const stream = new ReadableStream({
        async start(controller) {
            const encode = (/** @type {string} */ s) => new TextEncoder().encode(s);

            controller.enqueue(encode(`data: ${JSON.stringify(serializeList(doc))}\n\n`));

            const changeStream = db.collection('lists').watch(
                [{ $match: { 'documentKey._id': new ObjectId(params.id) } }],
                { fullDocument: 'updateLookup' }
            );

            const keepAlive = setInterval(() => {
                try { controller.enqueue(encode(': keep-alive\n\n')); } catch { /* closed */ }
            }, 30_000);

            const cleanup = () => {
                clearInterval(keepAlive);
                changeStream.close().catch(() => {});
            };

            request.signal.addEventListener('abort', cleanup);

            try {
                for await (const change of changeStream) {
                    if (request.signal.aborted) break;
                    if (change.operationType === 'delete') {
                        controller.enqueue(encode(`data: ${JSON.stringify({ deleted: true })}\n\n`));
                        break;
                    }
                    // @ts-ignore — fullDocument exists at runtime when using updateLookup
                    const updated = change.fullDocument
                        ?? await db.collection('lists').findOne({ _id: new ObjectId(params.id) });
                    if (updated) {
                        controller.enqueue(encode(`data: ${JSON.stringify(serializeList(updated))}\n\n`));
                    }
                }
            } finally {
                cleanup();
                try { controller.close(); } catch { /* already closed */ }
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}
