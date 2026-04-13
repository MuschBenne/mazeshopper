import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM } from '$env/dynamic/private';

/**
 * @param {string} to
 * @param {string} resetUrl
 */
export async function sendPasswordReset(to, resetUrl) {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: 'Återställ ditt lösenord – MazeShopper',
        text: [
            'Hej!',
            '',
            'Du (eller någon annan) har begärt att återställa lösenordet för ditt MazeShopper-konto.',
            '',
            'Klicka på länken nedan för att välja ett nytt lösenord:',
            resetUrl,
            '',
            'Länken är giltig i 15 minuter.',
            '',
            'Om du inte har begärt detta kan du ignorera detta mail – ditt lösenord förblir oförändrat.',
            '',
            '// MazeShopper'
        ].join('\n'),
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111827">
                <h2 style="margin-bottom:0.5rem">Återställ lösenord</h2>
                <p>Du (eller någon annan) har begärt att återställa lösenordet för ditt MazeShopper-konto.</p>
                <p>
                    <a href="${resetUrl}" style="display:inline-block;padding:0.6rem 1.2rem;background:linear-gradient(135deg,#f97316,#c026d3);color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
                        Välj nytt lösenord
                    </a>
                </p>
                <p style="color:#6b7280;font-size:0.85em">Länken är giltig i <strong>15 minuter</strong>.</p>
                <p style="color:#6b7280;font-size:0.85em">Om du inte har begärt detta kan du ignorera detta mail – ditt lösenord förblir oförändrat.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0">
                <p style="color:#9ca3af;font-size:0.8em">MazeShopper</p>
            </div>
        `
    });
}
