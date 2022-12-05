
export  class Account {
    name: string;
    email: string;
    phoneNumber: string;
    emailIsVerified: boolean;
    id: string;

    constructor(
        name: string,
        phoneNumber: string,
        email: string,
        id: string,
        emailIsVerified: boolean,
    ) {
        this.name = name;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.emailIsVerified = emailIsVerified;
        this.id = id;
    }

    get isValid():boolean {
        if(this.id == undefined || this.id == ''){
            return  false;
        }
        return this.email.length !== 0 && this.id.length !== 0 && this.emailIsVerified;
    }

    /// Validate E164 format
    get isValidE164Number(): boolean {
        return /^\+?[1-9]\d{1,14}$/.test(this.phoneNumber)
    }

    static empty() {
        return new Account(
            "",
            "",
            "",
            "",
            false,
        );
    }


    static fromJson(userObject: { name: string; phone: string; email: string; emailVerified: boolean; guid: string; }) {
        let name: string = userObject["name"];
        if (name === undefined || name.length === 0) {
            name = "";
        }
        return new Account(
            name,
            userObject["phone"],
            userObject["email"],
            userObject["guid"],
            userObject["emailVerified"],
        );
    }

    static collectionRef: string = 'users';

}
