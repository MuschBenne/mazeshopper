<div class="page">
    <a class="back" href="/">← Tillbaka</a>

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
                    <p>Registrera dig med ett användarnamn och lösenord. Dela sedan listan med familj eller sambo.</p>
                </div>
            </li>
            <li>
                <span class="step-num">2</span>
                <div>
                    <strong>Lägg till ditt varuhus</strong>
                    <p>Gå till Varuhus och skapa din butik. Rita sedan en rutt genom kategorirutorna i den ordning du passerar avdelningarna.</p>
                </div>
            </li>
            <li>
                <span class="step-num">3</span>
                <div>
                    <strong>Bygg listan</strong>
                    <p>Lägg till varor och välj kategori. Listan sorteras direkt efter din butiks rutt.</p>
                </div>
            </li>
            <li>
                <span class="step-num">4</span>
                <div>
                    <strong>Handla</strong>
                    <p>Tryck på 🛒 för att aktivera handelsläget — ett rent gränssnitt utan knappar. Kryssa av varor med ett tryck, varuhuset väljs direkt i vyn.</p>
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
                    <p>Rensar bort allt utom listan. Stora knappar, tydlig vy — perfekt med handskar eller i farten.</p>
                </div>
            </div>
            <div class="feature">
                <span>🗺️</span>
                <div>
                    <strong>Butiksrutt</strong>
                    <p>Rita en gång, spara för alltid. Listan ordnas automatiskt nästa gång du öppnar den med det varuhuset valt.</p>
                </div>
            </div>
            <div class="feature">
                <span>👥</span>
                <div>
                    <strong>Delade listor</strong>
                    <p>Bjud in vem som helst med ett användarnamn. Alla ser listan och kan pricka av varor.</p>
                </div>
            </div>
            <div class="feature">
                <span>🏷️</span>
                <div>
                    <strong>Kategorier</strong>
                    <p>Anpassa kategorier och färger under Inställningar. Ger bättre överblick och gör ruttritningen mer exakt.</p>
                </div>
            </div>
        </div>
    </section>

    <div class="cta">
        <a class="btn-cta" href="/">Skapa konto eller logga in</a>
    </div>
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
        color: #6b7280;
        text-decoration: none;
        font-size: 0.9em;
    }

    .back:hover { color: #111; }

    .hero-text h1 {
        margin: 0;
        font-size: 2.2rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #f97316, #c026d3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .tagline {
        margin: 0.4rem 0 0;
        color: #6b7280;
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
        color: #111827;
    }

    .section p {
        margin: 0;
        color: #374151;
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
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 0.9rem 1rem;
    }

    .step-num {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f97316, #c026d3);
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
        color: #111827;
        margin-bottom: 0.2rem;
    }

    .steps p {
        margin: 0;
        font-size: 0.84em;
        color: #6b7280;
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
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
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
        color: #111827;
        margin-bottom: 0.15rem;
    }

    .feature p {
        margin: 0;
        font-size: 0.82em;
        color: #6b7280;
        line-height: 1.4;
    }

    .cta {
        display: flex;
        justify-content: center;
    }

    .btn-cta {
        display: inline-block;
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.95em;
        text-decoration: none;
        transition: opacity 0.15s;
    }

    .btn-cta:hover { opacity: 0.9; }
</style>
