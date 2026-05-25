export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');

    try {
        const response = await fetch('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-czechia');
        if (!response.ok) throw new Error('Meteoalarm feed unavailable');
        const xml = await response.text();

        const get = (entry, tag) =>
            (entry.match(new RegExp(`<cap:${tag}[^>]*>([\\s\\S]*?)<\\/cap:${tag}>`)) || [])[1]?.trim() || '';

        const entries = xml.split('<entry>').slice(1);
        const seen = new Set();
        const warnings = [];

        for (const entry of entries) {
            const area = get(entry, 'areaDesc');
            if (!area.toLowerCase().includes('brno') && !area.toLowerCase().includes('jihomorav')) continue;

            const event = get(entry, 'event');
            const severity = get(entry, 'severity');
            const key = `${event}|${severity}`;
            if (seen.has(key)) continue;
            seen.add(key);

            warnings.push({
                event,
                severity,
                onset: get(entry, 'onset'),
                expires: get(entry, 'expires'),
                certainty: get(entry, 'certainty'),
                area,
            });
        }

        res.status(200).json({ warnings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
