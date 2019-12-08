#!/usr/bin/env node
const inquirer = require('inquirer');
const argv = require('yargs').argv;
const configFile = argv.config || 'argon.config';
const fs = require('fs-extra');
const chalk = require('chalk');
let config = null;
try {
    config = require(`${process.cwd()}/${configFile}`).createComponent;
} catch (e) {
    console.log(chalk.red(chalk.bold('An error occurred while loading configuration')));
    return;
}

let targetModule = 'component';
if (argv.atom) {
    targetFolder = 'atoms';
    targetModule = 'atom'
} else if (argv.molecule) {
    targetFolder = 'molecules';
    targetModule = 'molecule'
}

const questions = [
    {
        message: `Enter ${targetModule} name\nRules: \n1. Name should start with capital or small case\n2. Name should not start with a number\n3. Name can contain an underscore\n:`,
        name: "cName",
        type: 'text'
    }
];

function createComponent(name) {
    // Create folder structure
    const currentConfig = argv.atom
        ? 'atomsFolder'
        : argv.molecule
            ? 'moleculesFolder'
            : 'componentsFolder';
    const componentPath = `${process.cwd()}/${config[currentConfig]}/${name.toLowerCase()}`;
    fs.mkdirsSync(componentPath);
    // Create files
    fs.writeFileSync(`${componentPath}/_${name}.scss`, '');
    const templateFileName = name.toLowerCase();
    const jsFileName = `${name.charAt(0).toUpperCase()}${name.substring(1)}`;
    try {
        const isAtomOrMolecule = (argv.atom || argv.molecule);
        const slyComponentTemplate = fs.readFileSync(`${__dirname}/templates/slyComponentTemplate.txt`, 'utf8').toString();
        const slyTemplate = fs.readFileSync(`${__dirname}/templates/slyTemplate.txt`, 'utf8').toString();
        const jsTemplate = fs.readFileSync(`${__dirname}/templates/jsClassTemplate.txt`, 'utf8').toString();
        const jsTestTemplate = fs.readFileSync(`${__dirname}/templates/jsTestFileTemplate.txt`, 'utf8').toString();
        const uxPreviewTemplate = fs.readFileSync(`${__dirname}/templates/uxPreviewTemplate.txt`, 'utf8').toString();
        fs.writeFileSync(`${componentPath}/${templateFileName}-template.html`, (isAtomOrMolecule ? slyTemplate : slyComponentTemplate).replace('#templateFileName#', templateFileName).replace('#className#', jsFileName));
        if (!isAtomOrMolecule) {
            const instanceName = `${name.charAt(0).toLowerCase()}${name.substring(1)}`;
            fs.writeFileSync(`${componentPath}/${jsFileName}.js`, jsTemplate.replace(/#component#/g, jsFileName));
            fs.writeFileSync(`${componentPath}/${jsFileName}.spec.js`, jsTestTemplate.replace(/#component#/g, jsFileName).replace(/#instance#/g, instanceName));
            fs.writeFileSync(`${componentPath}/ux-model.json`, '{}');
            const previewHtml = uxPreviewTemplate.replace(/#name#/g, templateFileName);
            fs.writeFileSync(`${componentPath}/ux-preview.hbs`, previewHtml);
        }
        console.log(chalk.green(chalk.bold(`${targetModule} ${name} has been created!`)));
    } catch (e) {
        console.log(chalk.red(chalk.bold('Unable to read template file(s)!')));
    }
}

inquirer.prompt(questions)
    .then((data) => {
        if (
            data.cName
            && !(/^\d|[^A-Za-z0-9_]/).test(data.cName)
        ) {
            const inputComponentName = `${data.cName.charAt(0).toLowerCase()}${data.cName.substring(1)}`;
            // Check if component already exists
            try {
                let folder = config.componentsFolder;
                let moduleName = 'Component';
                if (argv.atom) {
                    folder = config.atomsFolder;
                    moduleName = 'Atom';
                } else if (argv.molecule) {
                    folder = config.moleculesFolder;
                    moduleName = 'Molecule';
                }
                if (!fs.existsSync(folder)) {
                    fs.mkdirsSync(folder);
                }
                const componentList = fs.readdirSync(`${process.cwd()}/${folder}`);
                if (componentList.includes(inputComponentName.toLowerCase())) {
                    console.log(chalk.red(chalk.bold(`${moduleName} with name ${inputComponentName} already exists!`)));
                } else {
                    createComponent(inputComponentName);
                }
            } catch (e) {
                console.log(chalk.red(chalk.bold('Something went wrong!')));
            }
        } else {
            console.log(chalk.red(chalk.bold('You need to provide a valid component name')));
        }
    })
    .catch(() => {
        console.log(chalk.red(chalk.bold('Something went wrong!')));
    });
