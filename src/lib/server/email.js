import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

/**
 * @param {string} to
 * @param {string} username
 * @param {string} verifyUrl
 */
export async function sendEmailVerification(to, username, verifyUrl) {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: 'Verifiera din e-postadress – MazeShopper',
        text: [
            `Hej ${username}!`,
            '',
            'Välkommen till MazeShopper! Klicka på länken nedan för att verifiera din e-postadress:',
            verifyUrl,
            '',
            'Länken är giltig i 24 timmar.',
            '',
            'Om du inte har skapat ett konto kan du ignorera detta mail.',
            '',
            '// MazeShopper'
        ].join('\n'),
        html: `
            <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#17211B">
                <h2 style="margin-bottom:0.5rem;font-weight:800;letter-spacing:-0.02em">Verifiera din e-postadress</h2>
                <p>Hej ${username}! Välkommen till MazeShopper.</p>
                <p>Klicka på knappen nedan för att verifiera din e-postadress och aktivera ditt konto.</p>
                <p>
                    <a href="${verifyUrl}" style="display:inline-block;padding:0.85rem 1.4rem;background:#0E5A3A;color:#fff;text-decoration:none;border-radius:12px;font-weight:700">
                        Verifiera e-postadress
                    </a>
                </p>
                <p style="color:#5E665F;font-size:0.85em">Länken är giltig i <strong>24 timmar</strong>.</p>
                <p style="color:#5E665F;font-size:0.85em">Om du inte har skapat ett konto kan du ignorera detta mail.</p>
                <hr style="border:none;border-top:1px solid #E3DED2;margin:1.5rem 0">
                <p style="color:#5E665F;font-size:0.8em">MazeShopper</p>
            </div>
        `
    });
}

/**
 * @param {string} to
 * @param {string} resetUrl
 */
export async function sendPasswordReset(to, resetUrl) {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
        from: env.EMAIL_FROM,
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
            <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#17211B">
                <h2 style="margin-bottom:0.5rem;font-weight:800;letter-spacing:-0.02em">Återställ lösenord</h2>
                <p>Du (eller någon annan) har begärt att återställa lösenordet för ditt MazeShopper-konto.</p>
                <p>
                    <a href="${resetUrl}" style="display:inline-block;padding:0.85rem 1.4rem;background:#0E5A3A;color:#fff;text-decoration:none;border-radius:12px;font-weight:700">
                        Välj nytt lösenord
                    </a>
                </p>
                <p style="color:#5E665F;font-size:0.85em">Länken är giltig i <strong>15 minuter</strong>.</p>
                <p style="color:#5E665F;font-size:0.85em">Om du inte har begärt detta kan du ignorera detta mail – ditt lösenord förblir oförändrat.</p>
                <hr style="border:none;border-top:1px solid #E3DED2;margin:1.5rem 0">
                <p style="color:#5E665F;font-size:0.8em">MazeShopper</p>
            </div>
        `
    });
}
