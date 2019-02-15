#!/usr/bin/env node

const Fs = require("fs");
const Git = require("nodegit");
const Path = require("path");

var userSettings = JSON.parse(Fs.readFileSync('config/user-settings.json','utf8'));
var settings = JSON.parse(Fs.readFileSync('config/settings.json','utf8'));
var projectPath = Path.resolve(settings["project-dir"]);

switcher(process.argv);

function switcher(argv){
    if (argv.slice(2) == 'clone'){
        cloning();
    }
    else if (argv.slice(2) == 'log'){
        viewlog();
    }
    else if (argv.slice(2) == 'commit'){
        addAndCommitting();
    }
    else if (argv.slice(2) == 'fetch'){
        fetching();
    } else {
        console.log(localPath);
    }
}

/**
 * Clone
 */
function cloning() {
    console.log("cloning...");
    var localPath = Path.join(__dirname, settings["project-dir"]);
    var cloneOptions = {};
    cloneOptions.fetchOpts = {
        callbacks: {
            certificateCheck: function() { return 1; },
            credentials: function() {
                return Git.Cred.userpassPlaintextNew(
                    userSettings["AccessToken"],
                    "x-oauth-basic"
                );
            }
        }
    };  
    Git.Clone(
        userSettings["remote-repository"],
        localPath,
        cloneOptions
        )
        .catch(errorAndAttemptOpen)
        .then(function (repository) {
            if (repository.isBare() == "false"){
                console.log("cloning completed!")
            }
        });
}
//Handling clone failure
var errorAndAttemptOpen = function(){
    return Git.Repository.open(localPath);
}

/**
 * Git log
 */
function viewlog() {
    // Open the repository directory.
    Git.Repository.open(projectPath)
    // Open the master branch.
    .then(function(repo) {
        return repo.getMasterCommit();
    })
    // Display information about commits on master.
    .then(function(firstCommitOnMaster) {
        // Create a new history event emitter.
        var history = firstCommitOnMaster.history();

        // Create a counter to only show up to 9 entries.
        var count = 0;

        // Listen for commit events from the history.
        history.on("commit", function(commit) {
            // Disregard commits past 9.
            if (++count >= 9) {
            return;
            }

            // Show the commit sha.
            console.log("commit " + commit.sha());

            // Store the author object.
            var author = commit.author();

            // Display author information.
            console.log("Author:\t" + author.name() + " <" + author.email() + ">");

            // Show the commit date.
            console.log("Date:\t" + commit.date());

            // Give some space and show the message.
            console.log("\n    " + commit.message());
        });

        // Start emitting events.
        history.start();
    });
}

/**
 * Add and Commit
 */
function addAndCommitting() {
    Git.Repository.open(projectPath)
        .then(function (repoResult) {
            repo = repoResult;
            return repo.refreshIndex();
        })
        .then(function (indexResult) {
            index = indexResult;
        })
        .then(function () {
            return index.addAll();
        })
        .then(function () {
            return index.write();
        })
        .then(function () {
            return index.writeTree();
        })
        .then(function (oidResult) {
            oid = oidResult;
            return Git.Reference.nameToId(repo,"HEAD");
        })
        .then(function (head) {
            return repo.getCommit(head);
        })
        .then(function (parent){
            var author = Git.Signature.now(userSettings["username"],userSettings["email"]);
            var committer = author;
            return repo.createCommit("HEAD", author, committer, "message", oid, [parent]);
        })
        .done(function(commitId){
            console.log("New Commit: ",commitId);
            console.log("committing completed!")
        });
}

/**
 * fetch
 */
function fetching() {
    Git.Repository.open(projectPath)
        .then(function (repo) {
            return repo.fetch("origin",{
                callbacks: {
                    credentials: function(/*url, userName*/){
                        // return Git.Cred.sshKeyFromAgent(userName);
                        return Git.Cred.userpassPlaintextNew(
                            userSettings["AccessToken"],
                            "x-oauth-basic"
                        );
                    }
                }
            });
        }).done(function(){
            console.log("fetching completed!")
        });
}

/**
 * marge -X ours
 */


/**
 * push
 */