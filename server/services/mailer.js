const sgMail = require("@sendgrid/mail");
const dotenv = require("dotenv")
dotenv.config()


sgMail.setApiKey(`${process.env.SG_KEY}`);

const sendSGMail = async ({
  to,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  try {
    const from = "developerfardin@gmail.com";
    const msg = {
      to: to,
      from: from,
      subject: subject,
      html: html,
      // text: text,
      attachments,
    };    
    return sgMail.send(msg);
  } catch (error) {
    console.log(error);
  }
};

exports.sendEmail = async (args) => {
  if (!process.env.NODE_ENV === "development") {
    return Promise.resolve();
  } else {
    return sendSGMail(args);
  }
};
