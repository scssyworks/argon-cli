#!/usr/bin/env node
const inquirer = require('inquirer');
const argv = require('yargs').argv;
const configFile = argv.config || 'argon.config';
const fs = require('fs-extra');
const chalk = require('chalk');
const path = require('path');
let config = null;
let globalConfig = null;
const NAME_VALIDATION_REGEX = /^\d|[^A-Za-z0-9_]/;
const globalConfigFilePath = `${process.cwd()}/${configFile}`;
try {
    globalConfig = require(globalConfigFilePath);
    config = globalConfig.createComponent;
} catch (e) {
    console.log(chalk.red(chalk.bold('An error occurred while loading configuration')));
    return;
}

const layouts = config.layouts || `${process.cwd()}/source/templates/layouts`;
if (typeof layouts !== 'string') {
    console.log(chalk.red(chalk.bold(`Missing configuration "layouts". Please update your config file's "createComponent" configuration to include "layouts" path.`)));
    return;
}

// Resolve Layout File name
let layoutFileName = '';
try {
    if (fs.lstatSync(layouts).isDirectory()) {
        // Get list of layouts
        const layoutFiles = fs.readdirSync(layouts).sort();
        layoutFileName = layoutFiles[0];
    } else {
        layoutFileName = path.basename(layouts);
    }
} catch (e) {
    console.log(chalk.red(chalk.bold(`The layouts are undefined OR "layouts" path specified seems to be incorrect.`)));
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

// Resolve webpack configuration
if (
    globalConfig.webpack
    && targetModule === 'component'
) {
    const webpackConfig = globalConfig.webpack;
    if (webpackConfig.cacheGroups) {
        const bundles = Object.keys(webpackConfig.cacheGroups).filter(bundle => webpackConfig.cacheGroups[bundle].testMultiple);
        questions.push({
            type: 'list',
            message: `Select a bundle where you wish to place your JavaScript file\nOR\nSelect "new" to create new bundle`,
            choices: ['[new]', ...bundles],
            default: '[new]',
            name: 'bundle'
        });
    }
}

function createNewBundle(bundle) {
    return new Promise((resolve, reject) => {
        if (bundle === '[new]') {
            inquirer.prompt([{
                message: 'Enter a bundle name',
                name: 'bundleName',
                type: 'text'
            }]).then(({ bundleName: name }) => {
                if (typeof name !== 'string') {
                    name = '';
                }
                name = name.trim();
                if (
                    name
                    && !NAME_VALIDATION_REGEX.test(name)
                    && !globalConfig.webpack.cacheGroups[name]) {
                    Object.assign(globalConfig.webpack.cacheGroups, {
                        [name]: {
                            testMultiple: true,
                            name,
                            enforce: true,
                            chunks: 'all'
                        }
                    });
                    Object.assign(globalConfig.webpack.componentGroups, {
                        [name]: []
                    });
                } else {
                    console.log(chalk.blue('Invalid name or bundle already exists!'));
                }
                resolve(name);
            }).catch(reject);
        } else {
            resolve(bundle);
        }
    });
}

function createComponent(name, bundle) {
    createNewBundle(bundle).then((bundleName) => {
        // Create folder structure
        const currentConfig = argv.atom
            ? 'atomsFolder'
            : argv.molecule
                ? 'moleculesFolder'
                : 'componentsFolder';
        const compRelativePath = `${config[currentConfig]}/${name.toLowerCase()}`;
        const componentPath = `${process.cwd()}/${compRelativePath}`;
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
                const previewHtml = uxPreviewTemplate.replace(/#name#/g, templateFileName).replace(/#layoutFileName#/, layoutFileName);
                fs.writeFileSync(`${componentPath}/${templateFileName}.hbs`, previewHtml);
            }
            console.log(chalk.green(chalk.bold(`${targetModule} ${name} has been created!`)));
        } catch (e) {
            console.log(chalk.red(chalk.bold('Unable to read template file(s)!')));
        }
        // Add bundle
        if (
            bundleName
            && !globalConfig.webpack.componentGroups[bundleName].includes(`${compRelativePath}/`)
        ) {
            globalConfig.webpack.componentGroups[bundleName].push(`${compRelativePath}/`);
            // Write configuration back
            fs.writeFileSync(globalConfigFilePath, JSON.stringify(globalConfig, null, 2));
        }
    }).catch(() => {
        console.log(chalk.red(chalk.bold('Something went wrong while resolving the bundle!')));
    });
}

inquirer.prompt(questions)
    .then((data) => {
        if (
            data.cName
            && !NAME_VALIDATION_REGEX.test(data.cName)
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
                    const params = [inputComponentName];
                    if (moduleName === 'Component') {
                        params.push(data.bundle);
                    }
                    createComponent(...params);
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
