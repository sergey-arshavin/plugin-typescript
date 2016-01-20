import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import * as chai from 'chai';
import * as ts from 'typescript';

import {createFactory} from '../lib/factory';
import {formatErrors} from '../lib/format-errors';

let should = chai.should();

let defaultFile = require.resolve('./fixtures-es6/tsconfig/default.json');
let alternateFile = require.resolve('./fixtures-es6/tsconfig/alternate.json');
let declarationFile = require.resolve('./fixtures-es6/tsconfig/declaration.json');
let theirModuleFile = require.resolve('./fixtures-es6/tsconfig/theirmodule.d.ts');
let defaultLib = require.resolve('typescript/lib/lib.es6.d.ts');
let filelist = [];

function fetch(filename) {
	//console.log("fetching " + filename);
	filelist.push(filename);
	let readFile = Promise.promisify(fs.readFile.bind(fs));
	return readFile(filename, 'utf8');
}

function resolve(dep, parent) {
	let result = undefined;

	//console.log('resolving ' + parent + ' -> ' + dep);

	try {
		if (dep === "ts")
			result = __filename;
		else if (dep === "tsconfig.json")
			result = defaultFile;
		else if (dep == "theirmodule")
			result = "theirmodule.js";
		else if (dep[0] === ".")
			result = path.resolve(path.dirname(parent), dep);
		else if (dep.indexOf(".") < 0)
			return dep + '.js';
		else
			result = require.resolve(dep);

		//console.log("resolved " + parent + " -> " + dep + " = " + result);
		return Promise.resolve(result);
	}
	catch(err) {
		console.error(err);
		return Promise.reject(err);
	}
}

describe('Factory', () => {

	beforeEach(function() {
		filelist = [];
	});

	it('handles sjsconfig = undefined', () => {
		let config = undefined;
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, typeChecker}) => {
			transpiler.should.be.defined;
			should.not.exist(typeChecker);
			filelist.should.have.length(0);
		});
	});

	it('handles tsconfig = undefined', () => {
		let config = {};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, typeChecker}) => {
			transpiler.should.be.defined;
			should.not.exist(typeChecker);
			filelist.should.have.length(0);
		});
	});

	it('creates typeChecker & resolver if typeCheck is true', () => {
		let config = {
			typeCheck: true,
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, resolver, typeChecker}) => {
			transpiler.should.be.defined;
			typeChecker.should.be.defined;
         resolver.should.be.defined;
		});
	});

	it('does not create typeChecker & resolver when typeCheck is false', () => {
		let config = {
			tsconfig: declarationFile,
			typeCheck: false
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, resolver, typeChecker}) => {
			transpiler.should.be.defined;
         should.not.exist(typeChecker);
			should.not.exist(resolver);
		});
	});

	it('handles tsconfig = true', () => {
		let config = {
			tsconfig: true
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, typeChecker}) => {
			transpiler.should.be.defined;
			should.not.exist(typeChecker);
			filelist.should.have.length(1);
			filelist[0].should.be.equal(defaultFile);
		});
	});

	it('loads the compiler options from tsconfig', () => {
		let config = {
			tsconfig: true
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, typeChecker}) => {
			transpiler._options.noImplicitAny.should.be.true;
		});
	});

	it('SystemJS.typescriptOptions take precedence over tsconfig settings', () => {
		let config = {
			tsconfig: true,
			noImplicitAny: false
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, typeChecker}) => {
			transpiler._options.noImplicitAny.should.be.false;
		});
	});

	it('handles tsconfig = <pathname>', () => {
		let config = {
			tsconfig: alternateFile
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({transpiler, typeChecker}) => {
			transpiler.should.be.defined;
			should.not.exist(typeChecker);
			filelist.should.have.length(1);
			filelist[0].should.be.equal(alternateFile);
		});
	});

	it('adds the default library', () => {
		let config = {
			typeCheck: true
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({resolver}) => {
			resolver.should.be.defined;
			resolver._declarationFiles.should.have.length(1);
		});
	});

	it('adds declaration files into resolver', () => {
		let config = {
			tsconfig: declarationFile,
			typeCheck: true
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({resolver}) => {
 			 resolver.should.be.defined;
		    resolver._declarationFiles.should.have.length(2);
			 resolver._declarationFiles[0].should.be.equal(defaultLib);
			 resolver._declarationFiles[1].should.be.equal(theirModuleFile);
		});
	});

	it('observes the noLib option', () => {
		let config = {
			noLib: true,
			typeCheck: true
		};
		let factory = createFactory(config, resolve, fetch);
		return factory.then(({resolver}) => {
			resolver.should.be.defined;
			resolver._declarationFiles.should.have.length(0);
		});
	});
});
