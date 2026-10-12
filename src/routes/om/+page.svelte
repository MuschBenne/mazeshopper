<script>
    import { authContext } from '$lib/context/auth-context.svelte';
</script>

<svelte:head><title>Om MazeShopper</title></svelte:head>

<div class="page">
    <a class="back" href={authContext.user ? '/inkopslista' : '/'}>← Tillbaka</a>

    <div class="hero-text">
        <h1>MazeShopper</h1>
        <p class="tagline">Den smarta inköpsappen som anpassar sig efter hur du handlar.</p>
    </div>

    <section class="section">
        <h2>Vad är MazeShopper?</h2>
        <p>
            MazeShopper är en delad inköpslista byggd för riktiga butiker. Istället för en
            generisk lista sorteras dina varor automatiskt i den ordning du faktiskt rör dig
            genom butiken — inga onödiga vändor tillbaka till mejeriavdelningen.
        </p>
    </section>

    <section class="section">
        <h2>Hur fungerar det?</h2>
        <ol class="steps">
            <li>
                <span class="step-num">1</span>
                <div>
                    <strong>Skapa ett konto</strong>
                    <p>Registrera dig med ett användarnamn och lösenord. Dela sedan listan med familj eller sambo — de behöver bara ett eget konto.</p>
                </div>
            </li>
            <li>
                <span class="step-num">2</span>
                <div>
                    <strong>Lägg till ditt varuhus</strong>
                    <p>Gå till Varuhus och skapa din butik. Lägg sedan kategorierna i den ordning du passerar avdelningarna — dra dem, eller flytta med pilknapparna.</p>
                </div>
            </li>
            <li>
                <span class="step-num">3</span>
                <div>
                    <strong>Bygg listan</strong>
                    <p>Skriv in varorna. Kategori är valfritt, men sätter du en sorteras listan direkt efter din butiks rutt.</p>
                </div>
            </li>
            <li>
                <span class="step-num">4</span>
                <div>
                    <strong>Handla</strong>
                    <p>Tryck Handla så tar listan över hela skärmen. Bocka av med ett tryck och se hur långt du kommit i raden överst.</p>
                </div>
            </li>
        </ol>
    </section>

    <section class="section">
        <h2>Funktioner</h2>
        <div class="features">
            <div class="feature">
                <span>🛒</span>
                <div>
                    <strong>Handelsläge</strong>
                    <p>Menyer och rubriker försvinner — bara listan är kvar. Stora knappar, förloppet överst, och skärmen slocknar inte medan du handlar.</p>
                </div>
            </div>
            <div class="feature">
                <span>🗺️</span>
                <div>
                    <strong>Butiksrutt</strong>
                    <p>Sätt ordningen en gång, spara för alltid. Listan ordnas automatiskt nästa gång du öppnar den med det varuhuset valt — också för den du delar med.</p>
                </div>
            </div>
            <div class="feature">
                <span>👥</span>
                <div>
                    <strong>Delade listor</strong>
                    <p>Bjud in vem som helst med ett användarnamn. Ni ser samma lista i realtid — bockar någon av en vara syns det direkt hos de andra.</p>
                </div>
            </div>
            <div class="feature">
                <span>🍲</span>
                <div>
                    <strong>Recept</strong>
                    <p>Spara ett recept med antal portioner. Vid import räknas mängderna om efter hur många ni ska bli. Dela med en länk — mottagaren får en egen kopia att ändra i.</p>
                </div>
            </div>
            <div class="feature">
                <span>📋</span>
                <div>
                    <strong>Mallar</strong>
                    <p>Återkommande varor som veckohandlingen eller städskåpet. Skapa en gång och importera till vilken lista som helst.</p>
                </div>
            </div>
            <div class="feature">
                <span>🏷️</span>
                <div>
                    <strong>Kategorier</strong>
                    <p>Egna kategorier med egna färger under Inställningar. Gruppera dem efter typ av handel — livsmedel, bygg, hem — så visas bara de som hör till.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="section">
        <h2>Hittade du en bugg?</h2>
        <p>
            Om något inte fungerar som det ska är du välkommen att höra av dig.
            Beskriv gärna vad som hände och hur man återupprepar det.
        </p>
        <a class="bug-link" href="mailto:benjamin@rosenbergab.com?subject=Buggrapport%20MazeShopper">
            Skicka buggrapport
        </a>
    </section>

    {#if !authContext.user}
        <div class="cta">
            <a class="btn-cta" href="/">Skapa konto eller logga in</a>
        </div>
    {/if}
</div>

<style>
    .page {
        max-width: 640px;
        margin: 0 auto;
        padding: 2rem 1rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .back {
        color: var(--text-muted);
        text-decoration: none;
        font-size: 0.9em;
    }

    .back:hover { color: var(--text-primary); }

    .hero-text h1 {
        margin: 0;
        font-size: 2.2rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        width: fit-content;
        background: var(--color-green);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .tagline {
        margin: 0.4rem 0 0;
        color: var(--text-muted);
        font-size: 1.05rem;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .section h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .section p {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.6;
        font-size: 0.95em;
    }

    .steps {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .steps li {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 0.9rem 1rem;
    }

    .step-num {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--gradient-brand);
        color: #fff;
        font-size: 0.85em;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .steps strong {
        display: block;
        font-size: 0.92em;
        color: var(--text-primary);
        margin-bottom: 0.2rem;
    }

    .steps p {
        margin: 0;
        font-size: 0.84em;
        color: var(--text-muted);
        line-height: 1.45;
    }

    .features {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .feature {
        display: flex;
        gap: 0.85rem;
        align-items: flex-start;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 0.85rem 1rem;
    }

    .feature span {
        font-size: 1.3rem;
        flex-shrink: 0;
        margin-top: 0.1rem;
    }

    .feature strong {
        display: block;
        font-size: 0.92em;
        color: var(--text-primary);
        margin-bottom: 0.15rem;
    }

    .feature p {
        margin: 0;
        font-size: 0.82em;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .cta {
        display: flex;
        justify-content: center;
    }

    .btn-cta {
        display: inline-block;
        padding: 0.75rem 2rem;
        background: var(--gradient-brand);
        color: #fff;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.95em;
        text-decoration: none;
        transition: opacity 0.15s;
    }

    .btn-cta:hover { opacity: 0.9; }

    .bug-link {
        display: inline-block;
        padding: 0.55rem 1.25rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        font-size: 0.9em;
        color: var(--text-secondary);
        text-decoration: none;
        background: var(--bg-surface);
        transition: background 0.15s;
        align-self: flex-start;
    }

    .bug-link:hover { background: var(--bg-elevated); }
</style>
