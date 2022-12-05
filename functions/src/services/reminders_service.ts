import {Account} from "../models/account";
import {RemindMethod} from "../models/notification_types";
import {BirthdaysList} from "../models/birthdays_list";
import {Birthday} from "../models/birthday";
import {MailService} from "@sendgrid/mail";
import {Twilio} from "twilio";
import functions from "firebase-functions";


interface RemindJob {
    user: Account,
    method: string,
    birthdays: Array<Birthday>
}

/// in charge of sending reminder messages to all users.
export class BirthdaysReminderMessenger {
    db: any;
    sgMail: MailService;

    smsClient: Twilio;
    twilioNumber: string;

    constructor(db: any, sgMail: MailService, smsClient: Twilio, twilioNumber: string) {
        this.db = db;
        this.sgMail = sgMail;
        this.smsClient = smsClient;
        this.twilioNumber = twilioNumber;
    }

    getMessage(job: RemindJob): string {
        if (job.birthdays.length === 1) {
            return job.birthdays[0].message(job.user.name, job.method);
        } else {
            return this.mergeBirthdaysInMessage(job.birthdays);
        }
    }

    // used to send all SMS messages
    // user's phone must be valid
    // the job's method must be equal to email
    // if birthdays are more than one, it will merge them in one message reminder.
    sendSMS = async (job: RemindJob) => {

        functions.logger.log("Sending sms to :  " + job.user.id + "" + job.user.phoneNumber);
        if (job.method === RemindMethod.sendSMS && job.user.isValidE164Number) {

            await this.smsClient.messages.create({
                body: this.getMessage(job),
                to: job.user.phoneNumber,  // Text to this number
                from: this.twilioNumber // From a valid Twilio number
            });
            functions.logger.log("SMS sent to  " + job.user.id + " this number" + job.user.phoneNumber);
        }
    }


    /// used to generate SMS message that's sent when the user has more than one reminder that day.
    mergeBirthdaysInMessage(birthdays: Array<Birthday>) {
        return `Some birthdays coming up: 🎉${birthdays.map((birthday) => birthday.oneLineDetail()).join("\n")}`;
    }


    // used to send all email reminders
    // user's email must be verified
    // the job's method must be equal to email
    // if birthdays are more than one, it will merge them in one message reminder.
    sendEmail = async (job: RemindJob) => {


        if (job.method === RemindMethod.sendEmail && job.user.emailIsVerified) {

            const msg = {
                to: job.user.email,
                from: StaticData.emailFrom,
                subject: 'Reminder from Celebrated!',
                text: this.getMessage(job),
                // html: `<strong>${message}</strong>`,
            };
            await this.sgMail.send(msg);
        }
    }

    // used to send all appPush Notification reminders
    // user's ID must be valid
    // the job's method must be equal to pushNotification
    // uses firebase cloud messaging
    // if birthdays are more than one, it will merge them in one message reminder.
    sendPushNotification(job: RemindJob) {
        // push notification
    }

    ///todo: service can know if message wasnt sent , and then tell clients app to let them know of erro, eg. verify thier phone number or email etc.


    // used to send all whatsapp Notification reminders
    // user's phone must be valid
    // the job's method must be equal to whatsapp
    // if birthdays are more than one, it will merge them in one message reminder.
    sendToWhatsapp = async (job: RemindJob) => {
        functions.logger.log("Sending whatsapp to :  " + job.user.id + "" + job.user.phoneNumber);
        if (job.method === RemindMethod.sendSMS && job.user.isValidE164Number) {

            await this.smsClient.messages.create({
                body: this.getMessage(job),
                to: `whatsapp:${job.user.phoneNumber}`,  // Text to this number
                from: `whatsapp:${this.twilioNumber}` // From a valid Twilio number
            });
            functions.logger.log("SMS sent to  " + job.user.id + " this number" + job.user.phoneNumber);
        }
    }

    // used to send all whatsapp Notification reminders
    // user's phone must be valid
    // the job's method must be equal to whatsappGroupReminder
    // if birthdays are more than one, it will merge them in one message reminder.
    sendToWhatsappGroup(job: RemindJob) {
        // sendToWhatsappGroup
    }


// scans for all  upcoming birthdays and users that need to be reminded
// and  returns a map linking each user in need of reminders, to the birthdays that are upcoming.
// This list is then used by the reminder to remind each user all upcoming birthdays at once.
// This is so that if a user has many birthdays upcoming they don't get separate messages.
    scanForRemindJobs2 = async (): Promise<Array<RemindJob>> => {

        const remindJobs = new Map<string, RemindJob>();
        // console.log("birthday-valid " + BirthdaysList.collectionRef);
        const docs = (await this.db.collection(BirthdaysList.collectionRef).get()).docs;
        functions.logger.log("Running reminder on  " + docs.length + " jobs");
        for (const doc of docs) {
            // const index = docs.indexOf(doc);
            const birthdayList = BirthdaysList.fromJson(doc.data());
            const author = await this.getUserAccountDetails(birthdayList.authorId);
            // console.log("birthday-valid "+JSON.stringify(doc.data()));
            //  console.log(`listIsValid:${birthdayList.isValid} accountIsValid: ${author.isValid}`);
            if (birthdayList.isValid && author.isValid) {
                console.log(birthdayList.notificationType);
                remindJobs.set(author.id, {user: author, birthdays: [], method: birthdayList.notificationType});
                birthdayList.birthdays.forEach((birthday: Birthday) => {
                    if (birthday.shouldSendReminder) {
                        let currentJob: RemindJob | undefined = remindJobs.get(author.id);
                        if (currentJob != undefined) {
                            currentJob.birthdays.push(birthday);
                            remindJobs.set(currentJob.user.id, currentJob);
                        }

                    }
                });

            }
            functions.logger.log("Loading docs " + doc.data()['id'] + "");
        }
        return Array.from(remindJobs.values());
    }

    scanForRemindJobs = async (): Promise<Array<RemindJob>> => {
        functions.logger.log("Scan has began");
        const jobs: Array<Promise<RemindJob>> = (await this.db.collection(BirthdaysList.collectionRef).get()).docs
            .filter(async (doc) => {
                const birthdayList = BirthdaysList.fromJson(doc.data());
                const author = await this.getUserAccountDetails(birthdayList.authorId);
                functions.logger.log("Filtering " + birthdayList.name + ` as valid: ${birthdayList.isValid && author.isValid}`);
                return birthdayList.isValid && author.isValid;
            })
            .map(async (doc) => {

                const birthdayList = BirthdaysList.fromJson(doc.data());
                const author = await this.getUserAccountDetails(birthdayList.authorId);
                const birthdaysToRemind: Array<Birthday> = birthdayList.birthdays
                    .filter((birthday: Birthday) => {
                        return birthday.shouldSendReminder(birthdayList.startReminding);
                    });


                const remindJob: RemindJob = {
                    user: author,
                    birthdays: birthdaysToRemind,
                    method: birthdayList.notificationType
                };
                functions.logger.log("Scanning job " + remindJob.user.name + " with: " + remindJob.method + "All birthdays: " + birthdayList.birthdays.length + " Runnable Birthdays: " + remindJob.birthdays.length);
                return remindJob;

            });


        return (await Promise.all(jobs)).filter((j) => j.birthdays.length >= 1);
    }
/// gets a map of user details --> birthdays to remind them and does
// the appropriate method of notification to the user.
// _functions.logger.log(JSON.stringify(birthday));
// _functions.logger.log(JSON.stringify(userObject));
    runRemindJobs = async (jobs: Array<RemindJob>) => {

        functions.logger.log("Running reminder on  " + jobs.length + " jobs");
        for (const job of jobs) {
            const index = jobs.indexOf(job);
            functions.logger.log("Running the job " + job.user.id + "");
            switch (job.method) {
                case  RemindMethod.sendSMS:
                    await this.sendSMS(job);
                    break;
                case  RemindMethod.sendEmail:
                    await this.sendEmail(job);
                    break;
                case  RemindMethod.sendWhatsapp:
                    await this.sendToWhatsapp(job);
                    break;
                case  RemindMethod.whatsappGroupReminder:
                    await this.sendToWhatsappGroup(job);
                    break;
                case  RemindMethod.pushNotification:
                    await this.sendPushNotification(job);
                    break;
            }

        }
        functions.logger.log("Completed function runRemindJobs");
    }


    getUserAccountDetails = async (uid: string) => {
        // console.log(`data is good   ${uid !== undefined && uid.trim().length > 0}`);
        if (uid === undefined || uid.trim().length === 0) {
            return Account.empty();
        }
        const obj: any = (await this.db.collection(Account.collectionRef).doc(uid).get()).data();

        // console.log(JSON.stringify(obj) + " " + uid);
        if (obj != undefined) {
            return Account.fromJson(obj);
        }
        return Account.empty();


    }


    /// runs all  the reminders
    static run = async (params: MessangerServiceParams) => {
        const messenger = new BirthdaysReminderMessenger(params.db, params.sgMail, params.smsClient, params.twilioNumber);
        return await messenger.runRemindJobs(await messenger.scanForRemindJobs());
    }

}


type MessangerServiceParams =
    {
        db: any;
        sgMail: MailService;
        smsClient: Twilio;
        twilioNumber: string
    }
