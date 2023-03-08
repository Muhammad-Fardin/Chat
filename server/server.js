const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1); 
});

const app = require("./app");
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { promisify } = require("util");
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log("DB Connection successful");
  });


const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});

io.on("connection", async (socket) => {
  const user_id = socket.handshake.query["user_id"];
  if (Boolean(user_id)) {
    await User.findByIdAndUpdate(user_id, {
      socket_id: socket.id,
      status: "Online",
    });
  }

  socket.on("friend_request", async (data) => {
    const to = await User.findById(data.to).select("socket_id");
    const from = await User.findById(data.from).select("socket_id");
    await FriendRequest.create({
      sender: data.from,
      recipient: data.to,
    });
    io.to(to.socket_id).emit("new_friend_request", {
      message: "New friend request received",
    });
    io.to(from.socket_id).emit("request_sent", {
      message: "Request Sent successfully!",
    });
  });

  socket.on("accept_request", async (data) => {
    const request_doc = await FriendRequest.findById(data.request_id);
    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recipient);
    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);
    await receiver.save({ new: true, validateModifiedOnly: true });
    await sender.save({ new: true, validateModifiedOnly: true });
    await FriendRequest.findByIdAndDelete(data.request_id);
    io.to(sender.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
    io.to(receiver.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
  });

  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id] },
    }).populate("participants", "firstName lastName _id email status");
    callback(existing_conversations);
  });

  socket.on("start_conversation", async (data) => {
    const { to, from } = data;
    const existing_conversations = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status");
    if (existing_conversations.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });
      new_chat = await OneToOneMessage.findById(new_chat).populate(
        "participants",
        "firstName lastName _id email status"
      );
      socket.emit("start_chat", new_chat);
    }
    else {
      socket.emit("open_chat", existing_conversations[0]);
    }
  });

  socket.on("get_messages", async (data, callback) => {
   const {messages} = await OneToOneMessage.findById(data.conversation_id).select("messages");
    callback(messages);
  });
  socket.on("text_message", async (data) => {
    console.log("Received message:", data);
    const { message, conversation_id, from, to, type } = data;
    const to_user = await User.findById(to);
    const from_user = await User.findById(from);
    const new_message = {
      to: to,
      from: from,
      type: type,
      created_at: Date.now(),
      text: message,
    };
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages.push(new_message);
    await chat.save({ new: true, validateModifiedOnly: true });
    io.to(to_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
    io.to(from_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
  });
  socket.on("file_message", (data) => {
    console.log("Received message:", data);
    const fileExtension = path.extname(data.file.name);
    const filename = `${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtension}`;
  });

  socket.on("end", async (data) => {
    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    }
    socket.disconnect(0);
  });
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  console.log("UNHANDLED REJECTION! Shutting down ...");
  server.close(() => {
    process.exit(1); 
  });
});
