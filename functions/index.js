// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();
const twilio = require('twilio');
const accountSid = functions.config().twilio.sid;
const authToken  = functions.config().twilio.token;
const client = new twilio(accountSid, authToken);

const twilioNumber = '+12267782306'


exports.scheduledFunction = functions.pubsub.schedule('every 5 minutes').onRun(async(context) => {
    console.log('This will be run every 5 minutes!');
    var query = await admin.firestore().collection('lists')
        .where('FIELD_NAME', '==', 'FIELD_VALUE')
        .get().then(result => {
            result.forEach((doc) => {
                console.log(doc.id, doc.data());
            });
        });
    return null;
});
