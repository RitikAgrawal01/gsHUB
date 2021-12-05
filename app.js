//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const multer = require('multer');
const helpers = require('./helpers');
const favicon = require('serve-favicon');
const path = require('path');

const app = express();

// const storage = multer.diskStorage({
//   destination: function(req, file, cb) {
//     cb(null, 'uploads/');
//   },
//
//   // By default, multer removes file extensions so let's add them back
//   filename: function(req, file, cb) {
//     cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
//   }
// });
// var upload = multer({
//   storage: storage
// });

app.use(express.static("public"));
// app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username: String,
  name: String,
  password: String,
  googleId: String,
  proImg: String,
  postId: [{
    type: String
  }]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/queries",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({
      username: profile.emails[0].value,
      name: profile.displayName,
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));


const postSchema = new mongoose.Schema({
  userId: String,
  query: String,
  comments: [{ body: String, date: { type: Date, default: Date.now } }],
  date: { type: Date, default: Date.now },
  likes: Number
});

// const commentSchema = new mongoose.Schema({
//   postId: String,
//   userId: String,
//   reply: String,
//   likes: Number
// }, {
//   timestamps: true
// });
//
// const likeSchema = new mongoose.Schema({
//   postId: String,
//   commentId: String,
//   userId: String,
//   isActive: Boolean
// });

const Post = new mongoose.model("Post", userSchema);

// const Comment = new mongoose.model("Comment", userSchema);
//
// const Like = new mongoose.model("Like", userSchema);

// app.post('/upload-profile-pic', (req, res) => {
//   // 'profile_pic' is the name of our file input field in the HTML form
//   let upload = multer({
//     storage: storage,
//     fileFilter: helpers.imageFilter
//   }).single('profile_pic');
//
//   upload(req, res, function(err) {
//     // req.file contains information of uploaded file
//     // req.body contains information of text fields, if there were any
//
//     if (req.fileValidationError) {
//       return res.send(req.fileValidationError);
//     } else if (!req.file) {
//       return res.send('Please select an image to upload');
//     } else if (err instanceof multer.MulterError) {
//       return res.send(err);
//     } else if (err) {
//       return res.send(err);
//     }
//
//     // Display uploaded image for user validation
//     res.send(`You have uploaded this image: <hr/><img src="${req.file.path}" width="500"><hr /><a href="./">Upload another image</a>`);
//   });
// });

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', {
    scope: ["profile", "email"]
  })
);

app.get("/auth/google/queries",
  passport.authenticate('google', {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect to queries.
    res.redirect("/queries");
  }
);

app.get("/about-us", function(req, res) {
  res.render("about-us");
});

app.get("/contacts", function(req, res) {
  res.render("contacts");
});

app.get("/login-signup", function(req, res) {
  res.render("login-signup");
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/queries", function(req, res) {
  if (req.isAuthenticated()) {
    User.find({
      "queries": {
        $ne: null
      }
    }, function(err, foundUsers) {
      if (err) {
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("queries", {
            usersWithQueries: foundUsers
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {

  const post = new Post({
    userId: req.user.id,
    query: req.body.query,
    likes: '0'
  });

  post.save(function(err){
    if(!err){
      res.redirect("/queries");
    }
    else{
      console.log(err);
    }
  });
  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
  // console.log(req.user.id);

  // User.findById(req.user.id, function(err, foundUser) {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     if (foundUser) {
  //       foundUser.queries.push(submittedQuery);
  //       foundUser.save(function() {
  //         res.redirect("/queries");
  //       });
  //     }
  //   }
  // });
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res) {
  let temp = req.body.username;
  let nam = "";
  for (let i = 0; temp[i] != '@'; i++) {
    nam = nam + temp[i];
  }

  User.register({
    username: req.body.username,
    name: nam
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/queries");
      });
    }
  });

});

app.post("/login", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/queries");
      });
    }
  });

});


app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
