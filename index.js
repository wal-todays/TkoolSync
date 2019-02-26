#!/usr/bin/env node
const FsE = require("fs-extra");
const Path = require("path");
const ReadlineSync = require('readline-sync');
let Git;

// make user-settings.json
try{
    // console.log("check config files.");
    FsE.statSync("config/user-settings.json");
}catch(err){
    if(err.code === "ENOENT"){
        makeUserSettings();
    }
}

// load config
// console.log("load config files.")
let userSettings = JSON.parse(FsE.readFileSync('config/user-settings.json','utf8'));
let settings = JSON.parse(FsE.readFileSync('config/settings.json','utf8'));
let localPath = Path.resolve(settings["working-dir"]);
let remote;
if (userSettings["AccessToken"]) {
    remote = userSettings["remote-repository"].replace(
        /^(https?:\/\/)(.+)/,
        function (match,p1,p2) {
            return p1+userSettings["username"]+":"+userSettings["AccessToken"]+"@"+p2
        });
}

// require simple-git
try{
    // console.log("attach repository.")
    Git = require("simple-git")(localPath);
}catch(err){
    console.log("repository is none. cloning repository...")
    require("simple-git")().clone(remote,localPath);
    try{
        Git = require("simple-git")(localPath);
        Git.checkIsRepo((err,isRepo) =>{
            if(isRepo) console.log("cloning completed!");
        });
    }catch(err){
        console.log("cloning failed. Something is wrong...");
        return;
    }
}

// set local configuration for author
Git.addConfig("user.name",userSettings["username"])
    .addConfig("user.email",userSettings["email"])
    .addConfig("merge.json.driver",Path.resolve("./node_modules/.bin/git-json-merge")+" %A %O %B")
    // .addConfig("merge.json.driver","$(npm bin)/git-json-merge %A %O %B")
    .addConfig("merge.json.name","custom merge driver for json files");

    // do command
switcher(process.argv);

/**
 * command switcher
 */
function switcher(argv){
    if (argv.slice(2)[0] == 'save'){
        var comment,currentBranch;
        comment = argv.slice(3).join(" ");
        while(!comment || comment==""){
            comment = ReadlineSync.question('Save Comment: ');
        }
        /*
        *///Git
        //format /data files
        Git.exec(()=>formatTkoolData())
        //add
        .add('./*',errorHandling)
        //commit
        .commit(comment,errorHandling)
        //pull
        .pull((err,data)=>{
            if(err){
            }
        })
        // Auto resolve conflicts
        .status((err,status)=>{
            errorHandling(err,status);
            if(status.conflicted.length > 0){
                console.log("conflict detected.");
                Git.status((err,status)=>{
                    console.log(status);
                    resolveConflict(status.conflicted);
                })
                .add("./*",errorHandling)
                .status((err,status)=>{
                    //errorHandling(err,status);
                    // Give up conflicts that can not be resolved by resolveConflict().
                    if(status.conflicted.length > 0){
                        console.log("Sorry, I can't resolve the conflict.");
                        console.log("Please resolve manually.");
                        process.exit(1);
                    }
                })
                .commit(comment+"[merged]",errorHandling)
                .exec(()=>{
                    console.log("conflict auto resolved.")
                });
            }
            currentBranch = status.current;
            // push
            Git.exec(()=>{
                console.log("push to origin/"+currentBranch);
            })
            .push("origin",currentBranch,errorHandling)
            .status((err,status)=>{
                console.log(status);
            });
        });
    }
    else if (argv.slice(2)[0] == 'load'){
        //　Check nothing change in the working directory.
        Git.status((err,status)=>{
            let count = 
                status.not_added.length +
                status.conflicted.length +
                status.created.length +
                status.deleted.length +
                status.modified.length +
                status.renamed.length +
                status.files.length +
                status.staged.length +
                status.ahead +
                status.behind;
            if(count>0){
                console.log("[ERROR] You have any change to working directory.");
                console.log("Please excute 'tksync save' first.");
                process.exit(1);
            }
        })
        .pull(errorHandling)
        .status((err,status)=>{
            if(status.conflicted.length == 0){
                console.log("load completed!")
            }else{
                console.log("[ERROR] any confliction occured in below files. Resolve manually.");
                console.log(status.conflicted);
            }
        });
    }
    else if (argv.slice(2)[0] == 'status'){
        Git.status((err,status)=>{
            console.log(status);
        });
    }
    else if (argv.slice(2)[0] == 'test'){
        console.log(argv);
        Git.status((err,status)=>{
            console.log(status);
        });
    }
    // else if (argv.slice(2) == 'diff'){
    //     Git.diff(["FETCH_HEAD"],(err,diffSummary)=>{
    //         if(!err){
    //             console.log("diff complete.");
    //             console.log(diffSummary);
    //         }else{console.log(err)}
    //     });
    // }
    else if (argv.slice(2)[0] == 'replace'){
        formatTkoolData();
    }
    else {
        console.log(
            "tksync (add|commit|push|pull|fetch|diff)");
    }
}

/**
 * error handling
 */
function errorHandling(err,data){
    if(err){
        console.log("[ERROR] "+err);
        console.log("[ERROR]"+data);
        process.exit(1);//異常終了
    }else{
        console.log(data);
    }
 }

/**
 * Make user-settings.json
 */
function makeUserSettings() {
    console.log("make config files.");
    let username,email,AccessToken,remoteRepository,workdir;
    
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
    // workdir = ReadlineSync.question('Working Directory <Default `../workdir`>: ');
    // if(!workdir){
    //     workdir = "../workdir"
    // }

    let userSettingsJson = {
        "username": username,
        "email": email,
        "AccessToken": AccessToken,
        "remote-repository": remoteRepository
    }
    // let settingsJson = {
    //     "working-dir": workdir
    // }
    
    FsE.writeJSONSync('./config/user-settings.json', userSettingsJson, {
        encoding: 'utf-8',
        replacer: null,
        spaces: '\t'
    },function(err){console.log(err)});
    
    // FsE.writeJSONSync('./config/settings.json', settingsJson, {
    //     encoding: 'utf-8',
    //     replacer: null,
    //     spaces: '\t'
    // },function(err){console.log(err)});
}

/**
 * replace Tkool Data json
 */
function formatTkoolData() {
    console.log("formatting start.")
    //search
    let searchDirPath = localPath+"/data";
    let files = FsE.readdirSync(searchDirPath);
    for(let i in files){
        let filename = files[i];
        //▼data内のjsonすべてに対して
        if(filename.split(".").lastIndexOf("json")){
            let sys = FsE.readJSONSync(localPath+"/data/"+filename);
            sys = JSON.stringify(sys,null,"\t");
            FsE.writeFileSync(localPath+"/data/"+filename,sys);
            /**
             * System.jsonに対して
             *  stringifyによる自動改行のみ
             */
            // if(filename.match("System.json")){
            //     let sys = FsE.readJSONSync(localPath+"/data/System.json");
            //     sys = JSON.stringify(sys,null,"\t");
            //     FsE.writeFileSync(localPath+"/data/System.json",sys);
            // }
            /**
             * MapXXX.jsonに対して
             *  dataの配列を1要素ずつ改行
             */
            // if(filename.match(/^Map\d+.json/)){
            //     let map = FsE.readFileSync(localPath+'/data/'+filename,'utf8');
            //     map = map.replace(/"data":\[(,?\d+)+]/,(match)=>{
            //         let splited = match.split(",");
            //         let joined = splited.join(",\n");
            //         return joined;
            //     });
            //     FsE.writeFileSync(localPath+'/data/'+filename, map);
            // }
        }
    }
    console.log("format end.")
}

function resolveConflict(conflictFiles) {
    console.log("resolve conflict");
    for (let i in conflictFiles){
        let filepath = conflictFiles[i]; //e.g. "data/System.json"
        console.log(filepath);
        if(filepath == "data/System.json"){
            //git checkout --ours fileA.txt
            console.log("checkout "+filepath);
            Git.checkout(['--ours',filepath],errorHandling);
        }
        else if(filepath.match(/^data\/Map\d+.json$/)){
            console.log("checkout "+filepath);
            Git.checkout(['--ours',filepath],errorHandling);
        }
    }
    console.log("end");
}
