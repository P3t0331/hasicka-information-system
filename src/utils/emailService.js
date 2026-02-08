import emailjs from '@emailjs/browser';

// EmailJS Configuration
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID_APPROVAL = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_APPROVAL;
const TEMPLATE_ID_DEACTIVATION = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_DEACTIVATION;
const PUBLIC_KEY = import.meta.env.EMAILJS_PUBLIC_KEY;
const APP_URL = import.meta.env.VITE_APP_URL;

/**
 * Sends an approval email to the user.
 * @param {string} userEmail - Recipient email
 * @param {string} userName - Recipient name
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export const sendApprovalEmail = async (userEmail, userName) => {
    try {
        const templateParams = {
            to_email: userEmail,
            to_name: userName,
            app_url: APP_URL,
        };

        const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID_APPROVAL, templateParams, PUBLIC_KEY);
        console.log('APPROVAL EMAIL SUCCESS!', response.status, response.text);
        return { success: true };
    } catch (error) {
        console.error('APPROVAL EMAIL FAILED...', error);
        return { success: false, error };
    }
};

/**
 * Sends a deactivation email to the user.
 * @param {string} userEmail - Recipient email
 * @param {string} userName - Recipient name
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export const sendDeactivationEmail = async (userEmail, userName) => {
    try {
        const templateParams = {
            to_email: userEmail,
            to_name: userName,
            app_url: APP_URL,
        };

        const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID_DEACTIVATION, templateParams, PUBLIC_KEY);
        console.log('DEACTIVATION EMAIL SUCCESS!', response.status, response.text);
        return { success: true };
    } catch (error) {
        console.error('DEACTIVATION EMAIL FAILED...', error);
        return { success: false, error };
    }
};
