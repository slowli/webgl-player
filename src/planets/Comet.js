(function(namespace) {

// Imports
var ParticleSource = namespace.ParticleSource;


function Comet() { }

Comet.prototype = Object.create(ParticleSource.prototype);

Comet.setup = function(parameters) {
	ParticleSource.setup.call(this, parameters);
	
	var hsl = this.color.getHSL(),
		helperColor = new THREE.Color().setHSL(hsl.h, Math.max(0.0, hsl.s - 0.5), hsl.l);
	this.pathHelper.color = helperColor;
};

namespace.Comet = Comet;

})(THREE);