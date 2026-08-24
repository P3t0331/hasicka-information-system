// Jediné místo, kde se počítá odpracovaná doba jednoho člena za jeden den
// služeb — dřív existovaly dvě nezávislé kopie (Statistiky, Dashboard),
// které se v detailech (vlastní čas přihlášení "z domova" u směny) rozešly
// a ukazovaly rozdílné součty hodin pro stejné dny.

export const DEFAULT_DAY_HOURS = 8;
export const DEFAULT_NIGHT_HOURS = 11;
const DEFAULT_ZALOHA_HOURS = 12;

function calcCustomHours(slot, defaultHours) {
    if (slot?.timeFrom && slot?.timeTo) {
        const [h1, m1] = slot.timeFrom.split(':').map(Number);
        const [h2, m2] = slot.timeTo.split(':').map(Number);
        let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
        if (diff < 0) diff += 24; // spans midnight
        return Math.round(diff * 100) / 100;
    }
    return defaultHours;
}

// `dayData` je jeden den z `shifts/{monthDoc}.days[den]` — obsahuje dayShift,
// nightShift, zalohaStaz a volitelně explicitní `hours[uid]` override.
export function getSplitHoursForUser(dayData, uid) {
    try {
        const data = dayData || {};
        const h = data.hours ? data.hours[uid] : null;
        let explicitDay;
        let explicitNight;

        if (h) {
            if (typeof h.day === 'number') explicitDay = h.day;
            if (typeof h.night === 'number') explicitNight = h.night;
        }

        const nightShift = data.nightShift || {};
        const dayShift = data.dayShift || {};
        const zalohaStaz = data.zalohaStaz || {};

        const daySlot = Object.values(dayShift).find(u => u && u.uid === uid) || null;
        const nightSlot = Object.values(nightShift).find(u => u && u.uid === uid) || null;
        const hasZaloha = Object.values(zalohaStaz).some(u => u && u.uid === uid);

        const dayHours = explicitDay !== undefined ? explicitDay : (daySlot ? calcCustomHours(daySlot, DEFAULT_DAY_HOURS) : 0);
        const nightHours = explicitNight !== undefined ? explicitNight : (nightSlot ? calcCustomHours(nightSlot, DEFAULT_NIGHT_HOURS) : 0);

        let zalohaHours = 0;
        if (hasZaloha) {
            zalohaHours = DEFAULT_ZALOHA_HOURS;
            if (zalohaStaz.config?.timeFrom && zalohaStaz.config?.timeTo) {
                const [h1, m1] = zalohaStaz.config.timeFrom.split(':').map(Number);
                const [h2, m2] = zalohaStaz.config.timeTo.split(':').map(Number);
                let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
                if (diff < 0) diff += 24; // spans midnight
                zalohaHours = diff;
            }
        }

        const fromHomeHours = (daySlot?.fromHome ? dayHours : 0) + (nightSlot?.fromHome ? nightHours : 0);
        const shiftTotal = dayHours + nightHours;

        return {
            day: dayHours,
            night: nightHours,
            zaloha: zalohaHours,
            fromHome: fromHomeHours,
            shiftTotal,
            total: shiftTotal + zalohaHours,
            isExplicit: !!h,
            hasDayShift: !!daySlot,
            hasNightShift: !!nightSlot,
            hasZaloha,
        };
    } catch (err) {
        console.error('Error calculating split hours:', err);
        return { day: 0, night: 0, zaloha: 0, fromHome: 0, shiftTotal: 0, total: 0, isExplicit: false, hasDayShift: false, hasNightShift: false, hasZaloha: false };
    }
}
