import { StyleSheet, Text, View } from 'react-native';

export default function MonthlyScreen() {
  return (
    <View style={styles.container}>
      <Text>Resumo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
