const sgMail = require("@sendgrid/mail");


console.log(process.env.SG_KEY);
sgMail.setApiKey("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");

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
