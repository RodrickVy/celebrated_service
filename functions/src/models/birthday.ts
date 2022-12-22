import {RemindMethod} from "./notification_types";
import functions from "firebase-functions";

export class Birthday {
    name: string;
    date: Date;

    constructor(name: string, date: Date) {
        this.name = name;
        this.date = date;
    }

    shouldSendReminder(remindStartRange: number): boolean {
        const currentDate = new Date();
        functions.logger.log(`${currentDate.toUTCString()}   :  ${this.date.toUTCString()} && days remaining ${this.daysRemainingTillBirthday}`)
        if (this.date.getMonth() === currentDate.getMonth()) {

            let difference: number = (this.date.getDate() - currentDate.getDate());
            if (difference <= remindStartRange && difference >= 0) {
                return true;
            }
        }
        return false;
    }

    get     daysRemainingTillBirthday() {
        if (this.shouldSendReminder) {
            return this.date.getDate() - (new Date()).getDate();
        }
        const date = this.date;
        date.setFullYear(new Date().getFullYear());
        return Date.now() - date.getUTCDate();
    }


    randomGreetMessage(name: string) {
        // todo implement randomness
        const otherMessages = [
            `Hey ${name}`,
            `Hello ${name}`,
        ];

        return otherMessages[0];
    }

    randomSuggestion(name: string) {
        // todo implement randomness
        const otherMessages = [
            `\n Create a card for ${name}💌: https://celebrated-app.web.app/home/cards\n Send ${name} a gift🎁: https://celebrated-app.web.app/home/gifts`,
        ];

        return otherMessages[0];
    }


    message(userName: string) {

            if (this.daysRemainingTillBirthday === 0) {
                return `🎉${this.randomGreetMessage(userName)}, its ${this.name}'s birthday today!`;
            } else if (this.daysRemainingTillBirthday === 1) {
                return `🎉Hey ${userName}, its ${this.name}'s birthday tomorrow!`;
            } else {
                return `🎉Hey ${userName}, its ${this.name}'s birthday in ${this.daysRemainingTillBirthday} days!`;
            }




    }

    messageEmail(userName: string) {
        if (this.daysRemainingTillBirthday === 0) {
            return `🎉its ${this.name}'s birthday today!`;
        } else if (this.daysRemainingTillBirthday === 1) {
            return `its ${this.name}'s birthday tomorrow!`;
        } else {
            return `its ${this.name}'s birthday in ${this.daysRemainingTillBirthday} days!`;
        }


    }

    oneLineDetail() {
        if (this.daysRemainingTillBirthday === 0) {
            return `${this.name}'s birthday is today`;
        } else if (this.daysRemainingTillBirthday === 1) {
            return `${this.name}'s birthday is tomorrow`;
        } else {
            return `${this.name}'s on ${this.date.toLocaleString('en-us', {weekday: 'long'})}`;
        }
    }

    relativeTime() {
        if (this.daysRemainingTillBirthday === 0) {
            return `today`;
        } else if (this.daysRemainingTillBirthday === 1) {
            return `tomorrow`;
        } else {
            return `on ${this.date.toLocaleString('en-us', {weekday: 'long'})}`;
        }
    }


}
