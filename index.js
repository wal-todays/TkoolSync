#!/usr/bin/env node

const FsE = require("fs-extra");
const Git = require("nodegit");
const Path = require("path");

try{
    FsE.statSync("config/user-settings.json");
} catch(err){
    if(err.code === "ENOENT"){
        makeUserSettings();
    }
}


let userSettings = JSON.parse(FsE.readFileSync('config/user-settings.json','utf8'));
let settings = JSON.parse(FsE.readFileSync('config/settings.json','utf8'));
let projectPath = Path.resolve(settings["project-dir"]);

switcher(process.argv);

/**
 * command switcher
 */
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
    // else if (argv.slice(2) == 'pull'){
    //     pulling();
    // }
    else if (argv.slice(2) == 'fetch'){
        fetching();
    }
    else if (argv.slice(2) == 'diff'){
        getDiff();
    }
    else {
        console.log(
            "tksync (clone|log|commit|diff|fetch)");
    }
}

/**
 * Make user-settings.json
 */
 function makeUserSettings() {
    const ReadlineSync = require('readline-sync');
    let username,email,AccessToken,remoteRepository;
    
    while (!username){
        username = ReadlineSync.question('Username <Require>: ');
    }
    while (!email){
        email = ReadlineSync.question('E-mail <Require>: ');
    }
    AccessToken = ReadlineSync.question('AccessToken <Option>: ',{
         hideEchoBack: true
        });
    while (!remoteRepository){
        remoteRepository = ReadlineSync.question('Remote repository URL <Require>: ');
    }
    let userSettingsJson = {
        "username": username,
        "email": email,
        "AccessToken": AccessToken,
        "remote-repository": remoteRepository
    }
    FsE.writeJSONSync('./config/user-settings.json', userSettingsJson, {
        encoding: 'utf-8',
        replacer: null,
        spaces: '\t'
    },function(err){console.log(err)});   
}
    
/**
 * Clone
 */
function cloning() {
    console.log("cloning...");
    let localPath = Path.join(__dirname, settings["project-dir"]);
    let cloneOptions = {};
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
            if (repository.isBare() == 0){
                console.log("cloning completed!");
            }
        });
}
//Handling clone failure
var errorAndAttemptOpen = function(){
    console.log("Some error occurred.")
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
        let history = firstCommitOnMaster.history();

        // Create a counter to only show up to 9 entries.
        let count = 0;

        // Listen for commit events from the history.
        history.on("commit", function(commit) {
            // Disregard commits past 9.
            if (++count >= 9) {
            return;
            }

            // Show the commit sha.
            console.log("commit " + commit.sha());

            // Store the author object.
            let author = commit.author();

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
    let repo,index,oid;
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
            let author = Git.Signature.now(userSettings["username"],userSettings["email"]);
            let committer = author;
            return repo.createCommit("HEAD", author, committer, "message", oid, [parent]);
        })
        .done(function(commitId){
            console.log("New Commit: ",commitId);
            console.log("committing completed!");
        });
}

/**
 * pull
 */
// function pulling() {
//     let repo;
//     Git.Repository.open(projectPath)
//         .then(function (repository) {
//             repo = repository;
//             return repo.fetchAll({
//                 callbacks: {
//                     credentials: function(){
//                         return Git.Cred.userpassPlaintextNew(
//                             userSettings["AccessToken"],
//                             "x-oauth-basic"
//                         );
//                     }
//                 },
//                 certificateCheck: function(){return 1}
//             });
//         }).then(function () {
//             return repo.mergeBranches("master","origin/master");
//         }).then(function (index) {
//             console.log(index.conflictGet(projectPath));
//             if(index.hasConflicts()){
//                 console.log("Conflict has occurred!");
//             }
//         })
//         /*.done(function () {
//             console.log("pulling completed!");
//         })*/;
// }

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
            console.log("fetching completed!");
        });
}

/**
 * Diff
 */
function getDiff() {
    Git.Repository.open(projectPath)
        .then(function (repo) {
            return repo.getHeadCommit();
        })
        .then(function (commit) {
            console.log("commit "+commit.sha());
            console.log("Author:"+commit.author.name()+" <"+commit.author.email()+">");
            console.log("Date:",commit.date());
            console.log("\n\t"+commit.message());
            return commit.getDiff();
        })
}

/**
 * marge -X ours
 */


/**
 * push
 */