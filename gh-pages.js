var ghpages = require("gh-pages");

ghpages.publish(
  "public",
  {
    branch: "main",
    repo: "https://github.com/supernintendo/supernintendo.github.io",
    user: {
      name: "May Matyi",
      email: "may@matyi.net",
    },
  },
  () => {
    console.log("deploy complete wew");
  }
);
