import dotenv from 'dotenv';
import amqp from 'amqplib';
import nodemailer from 'nodemailer';

dotenv.config(); // Load environment variables

const receiveMessages = async () => {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'emailQueue';

    await channel.assertQueue(queue, {
      durable: true,
    });

    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const emailDetails = JSON.parse(msg.content.toString());

        // Log the received email details
        console.log('Received email details:', emailDetails);

        // Ensure that all required fields are present
        if (!emailDetails.to || !emailDetails.subject || !emailDetails.text) {
          console.error('Missing required email fields:', emailDetails);
          channel.nack(msg, false, false); // Do not requeue
          return;
        }

        // Configure Nodemailer
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: emailDetails.to,
          subject: emailDetails.subject || 'No Subject',
          text: emailDetails.text || 'No content',
        };

        // Log mail options to ensure they are correct
        console.log('Mail options:', mailOptions);

        // Send the email
        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email sent to ${emailDetails.to}`);
          channel.ack(msg); // Acknowledge the message if sent successfully
        } catch (error) {
          console.error('Error sending email:', error);
          channel.nack(msg, false, false); // Do not requeue
        }
      }
    });
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
};

receiveMessages();
