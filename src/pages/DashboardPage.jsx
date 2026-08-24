import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLandingPage, getDashboardWidgetOrder, DEFAULT_DASHBOARD_WIDGET_ORDER } from '../../shared/preferences.js';
import useDashboardData from '../hooks/useDashboardData';
import WeatherWarnings from '../components/dashboard/WeatherWarnings';
import NewActivitiesBanner from '../components/dashboard/NewActivitiesBanner';
import ZalohaNotificationBanner from '../components/dashboard/ZalohaNotificationBanner';
import ImportantLinks from '../components/dashboard/ImportantLinks';
import MonthlyStatistics from '../components/dashboard/MonthlyStatistics';
import NextShiftCard from '../components/dashboard/NextShiftCard';
import UpcomingActivities from '../components/dashboard/UpcomingActivities';
import MyAbsences from '../components/dashboard/MyAbsences';
import BulletinWidget from '../components/dashboard/BulletinWidget';
import QuizWidget from '../components/dashboard/QuizWidget';

const WIDGET_COMPONENTS = {
    bulletin: BulletinWidget,
    nextShift: (props) => <NextShiftCard allShifts={props.allShifts} userData={props.userData} />,
    quiz: QuizWidget,
    monthlyStats: (props) => <MonthlyStatistics monthlyStats={props.monthlyStats} />,
    upcomingActivities: (props) => <UpcomingActivities upcomingActivities={props.upcomingActivities} />,
    myAbsences: (props) => <MyAbsences absences={props.absences} />,
    importantLinks: ImportantLinks,
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const {
        userData,
        allShifts,
        upcomingActivities,
        monthlyStats,
        absences,
        newZalohaShifts,
        newActivities
    } = useDashboardData();

    // Landing-page redirect must only fire ONCE per login session — otherwise a user
    // whose landing page isn't "dashboard" could never reach the Dashboard again (e.g.
    // clicking "Domů" would just bounce them straight back out). Guard with a one-shot
    // sessionStorage flag, set the moment we've evaluated it once for this session, and
    // cleared on logout (see AuthContext.logout) so the next login re-evaluates.
    useEffect(() => {
        if (!userData) return; // wait for real preferences before deciding
        if (sessionStorage.getItem('landingPageRedirectDone') === 'true') return;
        sessionStorage.setItem('landingPageRedirectDone', 'true');

        const landing = getLandingPage(userData?.preferences);
        if (landing === 'dashboard') return;
        if (landing === 'sluzby') navigate('/shifts', { replace: true });
        else if (landing === 'skoleni') navigate('/skoleni', { replace: true });
        else if (landing === 'kvizy') navigate('/skoleni', { replace: true, state: { scrollTo: 'kvizy-sekce' } });
    }, [userData, navigate]);

    const [activitiesDismissed, setActivitiesDismissed] = useState(
        sessionStorage.getItem('dismissed_new_activities') === 'true'
    );
    const [shiftsDismissed, setShiftsDismissed] = useState(
        sessionStorage.getItem('dismissed_new_shifts') === 'true'
    );

    const handleDismissActivities = () => {
        sessionStorage.setItem('dismissed_new_activities', 'true');
        setActivitiesDismissed(true);
    };

    const handleDismissShifts = () => {
        sessionStorage.setItem('dismissed_new_shifts', 'true');
        setShiftsDismissed(true);
        navigate('/shifts');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 10) return 'Dobré ráno';
        if (hour < 18) return 'Dobrý den';
        return 'Dobrý večer';
    };

    return (
        <div className="container dashboard-page" style={{ paddingBottom: '5rem' }}>
            {/* Header */}
            <header style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-heading-accent)' }}>
                    {getGreeting()},{' '}
                    <span style={{ color: 'var(--danger)' }}>{userData?.firstName || 'Hasiči'}</span>!
                </h1>
            </header>

            {/* Weather Warnings */}
            <WeatherWarnings />

            {/* New Záloha Notification Banner */}
            {!shiftsDismissed && (
                <ZalohaNotificationBanner
                    newZalohaShifts={newZalohaShifts}
                    onDismiss={handleDismissShifts}
                />
            )}

            {/* New Activities Banner */}
            {!activitiesDismissed && (
                <NewActivitiesBanner
                    newActivities={newActivities}
                    onDismiss={handleDismissActivities}
                />
            )}

            {getDashboardWidgetOrder(userData?.preferences, DEFAULT_DASHBOARD_WIDGET_ORDER).map((widgetId) => {
                const Widget = WIDGET_COMPONENTS[widgetId];
                if (!Widget) return null;
                return <Widget key={widgetId} allShifts={allShifts} userData={userData} monthlyStats={monthlyStats} upcomingActivities={upcomingActivities} absences={absences} />;
            })}
        </div>
    );
}
