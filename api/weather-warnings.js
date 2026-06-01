export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');

    try {
        const feedRes = await fetch('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-czechia');
        if (!feedRes.ok) throw new Error('Meteoalarm feed unavailable');
        const xml = await feedRes.text();

        const get = (text, tag) =>
            (text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)) || [])[1]?.trim() || '';

        const getAttr = (text, tag, attr) =>
            (text.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`)) || [])[1]?.trim() || '';

        const entries = xml.split('<entry>').slice(1);
        const seen = new Set();
        const detailFetches = [];

        for (const entry of entries) {
            const area = get(entry, 'cap:areaDesc');
            const areaLower = area.toLowerCase();

            // Include if Brno is explicitly mentioned in the area
            const mentionsBrno = areaLower.includes('brno');
            // Include if it covers all of Jihomoravský kraj (no subregion in parentheses)
            const isWholeJmk = areaLower.includes('jihomorav') && !area.includes('(');

            if (!mentionsBrno && !isWholeJmk) continue;

            const event = get(entry, 'cap:event');
            const severity = get(entry, 'cap:severity');
            const key = `${event}|${severity}`;
            if (seen.has(key)) continue;
            seen.add(key);

            // Find the cap+xml detail link
            const capLink = (entry.match(/href="(https:\/\/feeds\.meteoalarm\.org\/api\/v1\/warnings\/feeds-czechia\/[^"]+)"/) || [])[1];

            detailFetches.push({
                key,
                event,
                severity,
                onset: get(entry, 'cap:onset'),
                expires: get(entry, 'cap:expires'),
                capLink,
            });
        }

        // Fetch CAP details in parallel for Czech descriptions
        const warnings = await Promise.all(detailFetches.map(async (w) => {
            if (!w.capLink) return w;
            try {
                const detailRes = await fetch(w.capLink);
                if (!detailRes.ok) return w;
                const cap = await detailRes.text();

                // Prefer Czech language block
                const infoBlocks = cap.split('<info>').slice(1);
                const czBlock = infoBlocks.find(b => b.includes('<language>cs</language>')) || infoBlocks[0] || '';

                return {
                    ...w,
                    eventCz: get(czBlock, 'event') || w.event,
                    description: get(czBlock, 'description'),
                    instruction: get(czBlock, 'instruction'),
                };
            } catch {
                return w;
            }
        }));

        const now = new Date();
        const activeWarnings = warnings.filter(w => !w.expires || new Date(w.expires) > now);

        res.status(200).json({ warnings: activeWarnings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
