#! /usr/bin/perl -w

#
## @author: Shadow Caster
## @date: Tuesday 10 Feb 2009
## @version 0.0
## @license: Apache 2.0
##
## This script goes through the text of the diacritic-free Arabic quran from 
## 114 text files and counts how many times each word is written in the whole 
## text of the Quran. 
## It saves the results to a CSV file. Please use a spreadsheet program to 
## sort the list by the tally count.
## Note: This script takes about 2 minutes to finish on a fast computer.
#

#make a string of all quran
$m = "";
for($i = 1; $i < 115; $i++){
	open(HANDLE, "./c/$i.txt") or die("Couldn't open in file $i.txt");
	while(<HANDLE>){
		chomp($_);
		#adding spaces is important otherwise words stick together 
		# on each verse end
		$m .= " ".$_." "; 
	}
	close(HANDLE);
}

#make array of all words by splitting on spaces
$m =~ s/^\s+//g; #remove extra spaces at beginning
$m =~ s/\s+$//g; #remove extra spaces at end
$m =~ s/\s+/ /g; #remove multiple spaces
@arr = split(/ /, $m);

#The associative array in which the CSV data is temporarily stored
#%stor = {};

#go through each word and find how many time it occurs in the Quran 
#also do the same words without Al- if they have it
foreach $x(@arr){ 
	if(exists($stor{"$x"})){next;} #skip if already in table
	my $count = 0;
	while($m =~ /\s+$x\s+/g){$count++;} 
	$stor{"$x"} = $count if $count > 0;
	if($x =~ /^ال/){
		my $tnuoc = 0;
		$x =~ s/^ال//;
		if(exists($stor{"$x"})){next;} #skip if already in table
		while($m =~ /\s+$x\s+/g){$tnuoc++;}
		$stor{"$x"} = $tnuoc if $tnuoc > 0;
	}#/if
}#/foreach

#save values to CSV file
open(CSVHANDLE, ">./c/wordoccurancecount.csv") or die("Couldn't open CSV file");
while(($k, $v) = each(%stor)){
	print CSVHANDLE "$k, $v \n";
}
close(CSVHANDLE); 
print "All Done! \n";
