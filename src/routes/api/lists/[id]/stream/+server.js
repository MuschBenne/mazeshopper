import { getSessionUser } from '$lib/server/session';
import { hasListAccess, listAccessFilter, serializeList } from '$lib/server/utils';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const config = { maxDuration: 300 };

// Stäng strömmen med marginal före maxDuration ovan. Jitter så att klienter som
// anslöt samtidigt inte återansluter i samma sekund.
const streamLifetimeMs = () => 250_000 + Math.floor(Math.random() * 30_000);

export async function GET({ params, cookies, request }) {
    const username = await getSessionUser(cookies);
    if (!username) return new Response('Unauthorized', { status: 401 });
    if (!ObjectId.isValid(params.id)) return new Response('Not found', { status: 404 });

    const db = await getDb();
    const doc = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        ...listAccessFilter(username)
    });
    if (!doc) return new Response('Forbidden', { status: 403 });

    const stream = new ReadableStream({
        async start(controller) {
            const encode = (/** @type {string} */ s) => new TextEncoder().encode(s);

            // Funktionen har en maxlivslängd, så återanslutning sker rutinmässigt och
            // ska kännas sömlös. Håll intervallet nära webbläsarens eget default —
            // stängs strömmen direkt efter start blir det annars en tight loop.
            controller.enqueue(encode('retry: 3000\n\n'));
            controller.enqueue(encode(`data: ${JSON.stringify(serializeList(doc))}\n\n`));

            const changeStream = db.collection('lists').watch(
                [{ $match: { 'documentKey._id': new ObjectId(params.id) } }],
                { fullDocument: 'updateLookup' }
            );

            const keepAlive = setInterval(() => {
                try { controller.enqueue(encode(': keep-alive\n\n')); } catch { /* closed */ }
            }, 30_000);

            // Stäng strax innan plattformen tvångsavslutar funktionen, så klienten
            // hinner återansluta kontrollerat istället för att se en trasig ström.
            let expired = false;
            const lifetimeTimer = setTimeout(() => {
                expired = true;
                changeStream.close().catch(() => {});
            }, streamLifetimeMs());

            const cleanup = () => {
                clearInterval(keepAlive);
                clearTimeout(lifetimeTimer);
                changeStream.close().catch(() => {});
            };

            request.signal.addEventListener('abort', cleanup);

            try {
                for await (const change of changeStream) {
                    if (request.signal.aborted || expired) break;
                    if (change.operationType === 'delete') {
                        controller.enqueue(encode(`data: ${JSON.stringify({ deleted: true })}\n\n`));
                        break;
                    }
                    // @ts-ignore — fullDocument exists at runtime when using updateLookup
                    const updated = change.fullDocument
                        ?? await db.collection('lists').findOne({ _id: new ObjectId(params.id) });
                    if (!updated) continue;

                    // Åtkomsten kontrollerades när strömmen öppnades. Utan en ny
                    // kontroll här fortsätter en användare som tagits bort från
                    // sharedWith att få varje ändring tills anslutningen dör.
                    // Dokumentet finns redan i handen, så kontrollen är gratis.
                    if (!hasListAccess(updated, username)) break;

                    controller.enqueue(encode(`data: ${JSON.stringify(serializeList(updated))}\n\n`));
                }
            } catch (err) {
                // Iteratorn kastar när change streamen stängs under väntan — förväntat
                // vid livstidsstopp och vid att klienten kopplar ner. Allt annat är ett
                // verkligt fel och måste synas: headers har redan skickats, så klienten
                // ser bara en stängd ström och återansluter i all oändlighet.
                if (!expired && !request.signal.aborted) {
                    console.error('change stream failed for list', params.id, err);
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
