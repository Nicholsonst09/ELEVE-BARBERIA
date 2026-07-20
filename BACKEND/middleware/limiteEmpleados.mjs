// Limite de empleados por variable de entorno: permite topear cuantos
// empleados puede dar de alta
// un negocio segun el plan que contrato. Sin la variable, o con un valor
// invalido, no hay limite.
export function obtenerLimiteEmpleados() {
	const valor = Number(process.env.LIMITE_EMPLEADOS);
	return Number.isInteger(valor) && valor > 0 ? valor : null;
}
