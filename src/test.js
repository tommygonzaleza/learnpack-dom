const fs = require('fs')
const path = require('path')
const chalk = require("chalk")
const shell = require('shelljs')
const transformer = require.resolve('./_babelTransformer')
const { Utils, TestingError } = require('./utils/index.js')

let nodeModulesPath = path.dirname(require.resolve('jest'))
nodeModulesPath = nodeModulesPath.substr(0,nodeModulesPath.indexOf("node_modules")) + "node_modules/"

module.exports =  {
  validate: async function({ exercise, configuration }){

    if (!fs.existsSync(nodeModulesPath+'/prettier')) throw InternalError(`Uknown prettier path`);

    if (!shell.which('jest')) {
      const packageName = "jest@24.8.0";
      throw TestingError(`🚫 You need to have ${packageName} installed to run test the exercises, run $ npm i ${packageName} -g`);
    }

    return true
  },
  run: async ({ exercise, socket, configuration }) => {
    
    let jestConfig = {
      verbose: true,
      moduleDirectories: [nodeModulesPath],
      prettierPath: nodeModulesPath+'/prettier',
      transform: {
        "^.+\\.[t|j]sx?$": transformer
      },
    }

    const getEntry = () => {
      
      let testsPath = exercise.files.map(f => f.path).find(f => f.indexOf('test.js') > -1 || f.indexOf('tests.js') > -1);
      if (!fs.existsSync(testsPath))  throw TestingError(`🚫 No test script found on the exercise files`);
  
      return testsPath;
    }

    const getCommands = async function(){
      const reportedPath = path.resolve(__dirname,'./_reporter.js')
      if (!fs.existsSync(reportedPath))  throw TestingError(`🚫 Custom Jest Reporter not found for at ${reportedPath}`);

      jestConfig.reporters = [[ reportedPath, { reportPath: `${configuration.dirPath}/reports/${exercise.slug}.json` }]];
      return `jest --config '${JSON.stringify({ ...jestConfig, testRegex: getEntry() })}' --colors`
    }

    const getStdout = (rawStdout) => {
      let _stdout = [];
      if (fs.existsSync(`${configuration.dirPath}/reports/${exercise.slug}.json`)){
        const _text = fs.readFileSync(`${configuration.dirPath}/reports/${exercise.slug}.json`);
        const errors = JSON.parse(_text);
  
        _stdout = errors.testResults.map(r => r.message);
  
        if(errors.failed.length > 0){
          msg = `\n\n   ${'Your code must to comply with the following tests:'.red} \n\n${[...new Set(errors.failed)].map((e,i) => `     ${e.status !== 'failed' ? chalk.green.bold('✓ (done)') : chalk.red.bold('x (fail)')} ${i}. ${chalk.white(e.title)}`).join('\n')} \n\n`;
          _stdout.push(msg);
        }
      }
      else{
        return [rawStdout, "Could not find the error report for "+exercise.slug]
      } 
      return _stdout
    }

    let commands = await getCommands()

    if(!Array.isArray(commands)) commands = [commands]
    let stdout, stderr, code = [null, null, null]
    for(let cycle = 0; cycle < commands.length; cycle++){
      let resp = shell.exec(commands[cycle], { silent: true })
      stdout = resp.stdout
      code = resp.code
      stderr = resp.stderr
      if(code != 0) break
    }

    if(code != 0) throw TestingError(getStdout(stdout || stderr).join())
    else return stdout && stdout.length > 0 ? stdout : chalk.green("✔ All tests have passed")
  }
}